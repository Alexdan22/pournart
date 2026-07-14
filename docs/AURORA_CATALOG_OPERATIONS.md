# Aurora catalog operations readiness

## Local-only implementation boundary

Sprints 56-60 are implemented and validated sequentially on the local milestone branches. No command in this document authorizes a production backup, migration, environment change, PM2 action, or deployment. Those actions require the separate external-action approval.

## SQLite assumptions

- The inspected VPS runs one PM2 `fork` instance and one standalone Next.js server process.
- Production uses SQLite `DELETE` journal mode. This milestone does not change journal mode or introduce another database engine.
- Aurora runtime work may run four at a time. Aurora evaluation and review writes use one process-global dedicated Prisma client with Prisma's SQLite driver adapter, a verified connection-local 750 ms busy timeout, and a concurrency-one write queue. The general checkout/order Prisma client is unchanged.
- A transient SQLite lock is retried once after 50 ms. A second failure is returned only as an Aurora persistence failure.
- The local exclusive-lock rehearsal recovered from a 200 ms lock. A sustained lock returned `AURORA_PERSISTENCE_BUSY` in approximately 3.0 seconds after the single retry; it did not create a row, and an unrelated product write succeeded immediately after release.
- A PM2 instance-count or process-model change invalidates these assumptions and blocks deployment.

## Backup and restore rehearsal

The backup tool uses Python's SQLite online backup API. It never modifies the source database and refuses to restore over an existing file.

```powershell
python scripts/sqlite-backup.py backup --database prisma/dev.db --output-dir $env:TEMP/pna-backups --label manual
python scripts/sqlite-backup.py verify --database $env:TEMP/pna-backups/<backup>.db
python scripts/sqlite-backup.py restore --backup $env:TEMP/pna-backups/<backup>.db --destination $env:TEMP/pna-restore.db
```

Every backup records SHA-256, byte size, `PRAGMA integrity_check`, applied Prisma migrations, table row counts, and available disk space. Backup database and metadata files are private to their owner on POSIX systems and must never be committed.

The eventual production schedule is 14 daily and eight weekly copies. Local implementation documents this retention but does not configure a timer or modify the VPS.

## Migration rehearsal

1. Create a verified backup of the local source fixture.
2. Restore it to a new temporary file.
3. Set `DATABASE_URL` to the restored file for the command only.
4. Run `npm run db:deploy`; never run `db:seed`.
5. Run the backup tool's `verify` command again.
6. Compare migration names, representative Product/User/Order counts, and storefront queries with the source report.
7. Confirm the previous application can read its existing tables after the additive migrations.

The production-copy rehearsal and production migration remain external actions.

## Growth policy

Evaluation and review history is retained indefinitely. Review growth before the SQLite database reaches 500 MiB or grows by 100 MiB in one month. No automated deletion is authorized. The completion report will use measured stored-result sizes from the twelve-product validation rather than a speculative per-row estimate.

## Binding manifest and Studio handoff

`vendor/aurora/binding-manifest.json` is the repository authority. Runtime editing is not supported. Every entry uses an exact expected slug and keeps the database ID, binding ID, ProductDNA artifact ID, ProductDNA product ID, and RuleSet IDs separate. Optional environment-specific database IDs are keyed by `AURORA_PILOT_ENVIRONMENT`; a configured mismatch blocks execution. An absent key does not make a database ID authoritative.

Aurora Studio authors provide a candidate `aurora-project` v1 bundle and the reviewed identity list. Pour n Art maintainers prepare the matching candidate binding manifest and run:

```powershell
npm run aurora:preview -- --manifest <candidate-binding-manifest.json> --bundle <candidate-aurora-project.json>
```

The read-only preview reports additions, removals, changed bindings, duplicate identities, missing ProductDNA or RuleSet artifacts, checksum/fingerprint incompatibility, and resulting active/awaiting-review totals. It never writes the repository, database, or runtime configuration.

Activation requires one reviewed release commit containing both files and their updated deployment checksums. The previous bundle and manifest are retained together in the previous application release. Rollback switches the application release pair together; mixing either file across releases is prohibited.
