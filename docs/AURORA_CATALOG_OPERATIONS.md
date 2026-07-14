# Aurora catalog operations readiness

## Local-only implementation boundary

Sprints 56-59 are implemented and validated sequentially on the local milestone branch. Sprint 60 remains behind the approved ProductDNA checkpoint. No command in this document authorizes a production backup, migration, environment change, PM2 action, or deployment. Those actions require the separate external-action approval.

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

## Review workflow and note safety

Evaluation-level review begins as derived `NEW`. Decision-level review is created only when an admin explicitly transitions that exact Decision. The current `AuroraEvaluationReview` row and its append-only `AuroraReviewEvent` are written in one short serialized transaction with optimistic version checking. A newer evaluation never inherits review state.

Review notes are limited to 2,000 characters. The server normalizes line endings and rejects prohibited control characters plus obvious email, phone, credential-label, bearer-token, JWT, and API-key patterns. This pattern detection is only a guardrail and cannot guarantee that sensitive data is absent. The UI therefore displays: “Do not enter customer information, passwords, tokens, credentials or secrets.”

Notes are escaped by React and are never logged. They remain outside Aurora result JSON, DTOs, input snapshots, context/artifact fingerprints, cache identities, and operational exports. Only independently authorized ADMIN and allowlisted review routes return review history.

## Evaluation lifecycle and lookup order

Current and stale state is derived at request time from each immutable evaluation snapshot and the current exact product, binding, bundle, SDK, and runtime-contract identities. No stale, current, or superseded flag is stored. The relevant catalog identity includes publication, active/archive state, the inventory zero boundary, exact lead-time values, required-content presence, canonical customization schema, and approved explicit facts.

Product name, price, compare-at price, featured state, low-stock threshold, `updatedAt`, positive inventory changes, nonempty content replacement, category replacement while presence remains satisfied, and customization JSON whitespace or object-key order do not stale an evaluation. Product changes never trigger Aurora automatically.

`REUSE_CURRENT` follows process cache, then database, then Aurora runtime. `REEVALUATE` bypasses reuse and creates a new immutable attempt. `RETRY` executes only when a failed attempt exists for the exact current context; otherwise it reuses an exact current success when available. A failed refresh removes the process-cache acceleration entry so database reads expose both the retained valid success and the newer safe failure codes. Operational logs record only lookup source, hit/miss/bypass, duration, safe issue codes, and permitted IDs.

The process cache is capped at 200 successful results and is acceleration only. A change from the verified single PM2 process is a deployment stop condition because process-local single-flight is not cross-process coordination.
