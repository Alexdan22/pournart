#!/usr/bin/env python3
"""Create and verify consistent SQLite backups without modifying the source database."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import stat
import sys
from datetime import datetime, timezone


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    backup_parser = subparsers.add_parser("backup")
    backup_parser.add_argument("--database", required=True)
    backup_parser.add_argument("--output-dir", required=True)
    backup_parser.add_argument("--label", choices=("manual", "daily", "weekly"), default="manual")
    backup_parser.add_argument("--retain", type=int, default=0)
    backup_parser.add_argument("--minimum-free-bytes", type=int, default=50 * 1024 * 1024)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--database", required=True)

    restore_parser = subparsers.add_parser("restore")
    restore_parser.add_argument("--backup", required=True)
    restore_parser.add_argument("--destination", required=True)

    args = parser.parse_args()
    if args.command == "backup":
        return backup(Path(args.database), Path(args.output_dir), args.label, args.retain, args.minimum_free_bytes)
    if args.command == "verify":
        print(json.dumps(inspect_database(Path(args.database)), sort_keys=True))
        return 0
    return restore(Path(args.backup), Path(args.destination))


def backup(source: Path, output_dir: Path, label: str, retain: int, minimum_free_bytes: int) -> int:
    source = require_database(source)
    output_dir = output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    ensure_private_directory(output_dir)
    free_bytes = shutil.disk_usage(output_dir).free
    required_bytes = max(minimum_free_bytes, source.stat().st_size * 3)
    if free_bytes < required_bytes:
        raise RuntimeError("Insufficient free space for a verified SQLite backup.")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = output_dir / f"pour-n-art-{label}-{stamp}.db"
    if destination.exists():
        raise RuntimeError("Refusing to overwrite an existing backup.")

    source_connection = sqlite3.connect(f"file:{source.as_posix()}?mode=ro", uri=True)
    destination_connection = sqlite3.connect(destination)
    try:
        source_connection.backup(destination_connection)
        destination_connection.commit()
    finally:
        destination_connection.close()
        source_connection.close()
    os.chmod(destination, stat.S_IRUSR | stat.S_IWUSR)

    report = inspect_database(destination)
    report.update(
        {
            "sourceBytes": source.stat().st_size,
            "freeBytesBefore": free_bytes,
            "label": label,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    metadata = destination.with_suffix(".json")
    metadata.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    os.chmod(metadata, stat.S_IRUSR | stat.S_IWUSR)
    if retain > 0:
        prune(output_dir, label, retain)
    print(json.dumps({"backup": str(destination), "metadata": str(metadata), **report}, sort_keys=True))
    return 0


def restore(backup_path: Path, destination: Path) -> int:
    backup_path = require_database(backup_path)
    destination = destination.expanduser().resolve()
    if destination.exists():
        raise RuntimeError("Restore destination already exists; in-place overwrite is prohibited.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    source_connection = sqlite3.connect(f"file:{backup_path.as_posix()}?mode=ro", uri=True)
    destination_connection = sqlite3.connect(destination)
    try:
        source_connection.backup(destination_connection)
        destination_connection.commit()
    finally:
        destination_connection.close()
        source_connection.close()
    os.chmod(destination, stat.S_IRUSR | stat.S_IWUSR)
    report = inspect_database(destination)
    print(json.dumps({"restored": str(destination), **report}, sort_keys=True))
    return 0


def inspect_database(path: Path) -> dict[str, object]:
    path = require_database(path)
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError("SQLite integrity check failed.")
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            )
        ]
        row_counts = {table: connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0] for table in tables}
        migrations = []
        if "_prisma_migrations" in tables:
            migrations = [
                row[0]
                for row in connection.execute(
                    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY finished_at'
                )
            ]
    finally:
        connection.close()
    return {
        "sha256": file_sha256(path),
        "bytes": path.stat().st_size,
        "integrity": "ok",
        "migrations": migrations,
        "rowCounts": row_counts,
    }


def prune(output_dir: Path, label: str, retain: int) -> None:
    candidates = sorted(output_dir.glob(f"pour-n-art-{label}-*.db"), key=lambda item: item.name, reverse=True)
    root = output_dir.resolve()
    for stale in candidates[retain:]:
        resolved = stale.resolve()
        if root not in resolved.parents:
            raise RuntimeError("Backup retention target escaped the configured output directory.")
        metadata = resolved.with_suffix(".json")
        resolved.unlink()
        if metadata.exists() and root in metadata.resolve().parents:
            metadata.unlink()


def require_database(path: Path) -> Path:
    resolved = path.expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(f"SQLite database not found: {resolved}")
    return resolved


def ensure_private_directory(path: Path) -> None:
    if os.name != "nt":
        os.chmod(path, stat.S_IRWXU)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), file=sys.stderr)
        raise SystemExit(1)
