# Aurora catalog operations readiness

## Local-only implementation boundary

Sprints 56-60 are implemented and validated sequentially on the local milestone branches. The Sprint 60 ProductDNA checkpoint was approved before the four new artifacts were created. No command in this document authorizes a production backup, migration, environment change, PM2 action, bundle replacement, or deployment. Those actions require the separate external-action approval.

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

Evaluation and review history is retained indefinitely. Review growth before the SQLite database reaches 500 MiB or grows by 100 MiB in one month. No automated deletion is authorized.

The twelve-product local validation produced 395,905 bytes of exact successful-result JSON: 32,992 bytes average, 26,609 bytes minimum, and 38,377 bytes maximum. One complete twelve-product evaluation generation therefore contributes about 0.38 MiB of result JSON before row, index, input-snapshot, and review overhead. At one full generation per week, raw result JSON is approximately 19.6 MiB per year; operational capacity planning should allow roughly 25–40 MiB per year after SQLite and metadata overhead, then replace that estimate with observed monthly growth.

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

## Twelve-product release candidate

- Aurora source commit: `df5d6b3122fedf0890ed75435ad93c7c21eeed73`.
- Pour n Art parent commit: `e877ddf2725e99df3c7bd73897221ff5395c2596`; the completion report records the resulting rollout commit.
- Project ID: `project.pna.catalog-intelligence-pilot`; bundle format remains `aurora-project` v1.
- Bundle SHA-256: `952c282b07fa272f3e86b2dea50bd8b66e9efd3cee558b42076638fa5ee5df7c`.
- Project fingerprint: `0f724ca61d7ea9ba5599d54b0b6a8f508082bf6c5beff6b66095f964e930ff2b`.
- Binding manifest fingerprint: `03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499`.
- Twelve active exact-slug bindings; no awaiting-review binding and no expected database ID is configured.
- The unchanged unpublished SDK remains `@aurora/sdk@1.0.0-pilot.1` from source commit `c69147e88a43dda5a475f22e6233a7df65299614`.

The bundle and binding manifest are one atomic release pair. Deploying this pair intentionally makes every prior evaluation stale through the bundle, artifact, and manifest fingerprints. It does not automatically execute Aurora or modify product records.

The previous eight-product pair remains in the currently deployed release `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9` with bundle SHA-256 `0a3c80b5968b223309a249e7e91c1ee33a865c14c74e66d3fdd260f5bb873f5f` and project fingerprint `152fffc7eabc54be771497037c815f6be5ab9c239acfcf65aef79c8c16f70d52`. Bundle rollback switches the whole application release; never mix the old bundle with the new binding manifest or deployment checksum.

## Externally gated migration and rollout

After separate approval: record PM2 shape and unrelated PIDs; take and verify an online database backup; rehearse both migrations against a VPS-local restored copy; disable Aurora; stop only `pour-n-art`; take a final quiesced backup; run migration-only `npm run db:deploy`; switch the atomic release; start only `pour-n-art`; and validate storefront, checkout, admin, database integrity, disabled Aurora, and unrelated PIDs before activation. Never run `db:seed`.

Activation then reuses the existing ADMIN allowlist, restarts only `pour-n-art`, verifies health and one canary, verifies persisted canary history after one controlled restart, evaluates the four additions, and begins the approved seven-day observation. Rollback disables Aurora first and returns to the prior application release with additive tables left intact. Database restoration is allowed only before customer traffic resumes or under a separately approved reconciliation plan.
