# Aurora catalog operations readiness

## Production rollout status

Sprints 56-60 were implemented and validated sequentially. External approval was granted on 2026-07-14, and the approved Pour n Art commits were fast-forwarded to `master` and pushed through `281148d580adc92dca8200bc857df26970ebb154`. Aurora was fast-forwarded locally through `df5d6b3122fedf0890ed75435ad93c7c21eeed73`; its configured remote has no `master` branch or verified upstream, so remote backup remains pending.

The catalog-operations application release and both additive migrations are installed on the VPS, but the Aurora pilot is disabled. Activation stopped at the Stage 7 identity-reporting gate because `/api/admin/aurora/health` did not include the required binding-manifest fingerprint. No canary or catalog evaluation ran, no Aurora evaluation/review row was created, backup scheduling was not installed, and the seven-day observation period did not begin. A code correction, local validation, separate deployment, and renewed activation approval are required before evaluation.

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

The approved production schedule remains 14 daily and eight weekly copies. It was not installed because activation stopped before the Stage 10 scheduling gate.

## Migration rehearsal

1. Create a verified backup of the local source fixture.
2. Restore it to a new temporary file.
3. Set `DATABASE_URL` to the restored file for the command only.
4. Run `npm run db:deploy`; never run `db:seed`.
5. Run the backup tool's `verify` command again.
6. Compare migration names, representative Product/User/Order counts, and storefront queries with the source report.
7. Confirm the previous application can read its existing tables after the additive migrations.

The production-copy rehearsal and production migration completed on 2026-07-14. The rehearsal applied both migrations to a restored production backup, preserved critical row counts, passed representative catalog and order queries, and restored independently. Production then applied only the same two migrations while `pour-n-art` was stopped. Production now has eight applied migrations and an `ok` integrity check; no seed command ran.

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
- Pour n Art release commit: `281148d580adc92dca8200bc857df26970ebb154`.
- Project ID: `project.pna.catalog-intelligence-pilot`; bundle format remains `aurora-project` v1.
- Bundle SHA-256: `952c282b07fa272f3e86b2dea50bd8b66e9efd3cee558b42076638fa5ee5df7c`.
- Project fingerprint: `0f724ca61d7ea9ba5599d54b0b6a8f508082bf6c5beff6b66095f964e930ff2b`.
- Binding manifest fingerprint: `03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499`.
- Twelve active exact-slug bindings; no awaiting-review binding and no expected database ID is configured.
- The unchanged unpublished SDK remains `@aurora/sdk@1.0.0-pilot.1` from source commit `c69147e88a43dda5a475f22e6233a7df65299614`.

The bundle and binding manifest are one atomic release pair. Deploying this pair intentionally makes every prior evaluation stale through the bundle, artifact, and manifest fingerprints. It does not automatically execute Aurora or modify product records.

The previous eight-product pair remains intact in rollback release `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9` with bundle SHA-256 `0a3c80b5968b223309a249e7e91c1ee33a865c14c74e66d3fdd260f5bb873f5f` and project fingerprint `152fffc7eabc54be771497037c815f6be5ab9c239acfcf65aef79c8c16f70d52`. Bundle rollback switches the whole application release; never mix the old bundle with the new binding manifest or deployment checksum.

## Production evidence - 2026-07-14

- Active release: `/home/alex/pour-n-art/releases/20260714-074049-catalog-operations-281148d`.
- Rollback release: `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9`.
- Online backup: `/home/alex/pour-n-art/backups/sqlite/pour-n-art-manual-20260714T072500Z.db`, SHA-256 `cd915015eb91355b5732e0b6312c22af0b0d1f03ec445db2c2589336c25fc0db`, 454,656 bytes, integrity `ok`.
- Quiesced backup: `/home/alex/pour-n-art/backups/sqlite/pour-n-art-manual-20260714T074330Z.db`, the same checksum and size, integrity `ok`, mode `600`.
- Rehearsal output: eight migrations, SHA-256 `b45bc9d4534d54e88cf04ffba9e619ac700f64eea5ccd9d1716e98d5b547d9e5`, 540,672 bytes, integrity `ok`; an independent restore of the source backup matched its original checksum.
- Production after migration: eight migrations, three Aurora tables, 16 Aurora indexes, zero Aurora evaluation/review rows, 540,672-byte database, integrity `ok`, and unchanged critical counts of four users, twelve products, one order, one order item, and six categories.
- Disabled smoke checks passed for storefront, product list/detail, empty-cart checkout, authenticated admin dashboard, orders, disabled Aurora health, absent customer Aurora route, and unrelated process isolation.
- PM2 `pour-n-art` changed from PID `139393` to `167186` for the disabled release, to `167515` for the attempted activation, and to `167697` when the safety handler disabled the pilot. `pullback` `134533`, `telegram-listener` `19571`, and `webfoot-api` `19581` never changed.
- Authorization checks passed: unauthenticated `401`, non-admin `403`, non-allowlisted admin `403`, allowlisted admin `200`, and customer Aurora endpoint `404`.
- Runtime health reported initialized status, SDK `1.0.0-pilot.1`, the expected project ID, bundle checksum, project fingerprint, and no issue codes. It did not report binding-manifest fingerprint `03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499`; activation therefore failed closed.
- Safety response: set `AURORA_PILOT_ENABLED=false`, restarted only `pour-n-art`, removed temporary smoke credentials, confirmed zero prohibited log-keyword matches, and left the additive migrations in place.

## Next gated action

Add the validated binding-manifest fingerprint to the authenticated health contract, repeat local tests/build and release validation, then request renewed approval to deploy and repeat Stage 7. Do not run a canary, catalog evaluation, backup schedule, or observation period until that identity gate passes. Application rollback remains available by disabling Aurora and atomically switching to the previous release; database restoration is not required for the healthy additive schema.
