# Aurora Live Pilot - controlled VPS operation

## Active pilot deployment

- Environment: Pour n Art production VPS, accessed through SSH host alias `my_vps`.
- Application root: `/home/alex/pour-n-art`.
- Active release: `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9`.
- Pour n Art commit: `8b208c91091e341597244e3c3919d34269870dc1`.
- Process manager: PM2.
- Process name: `pour-n-art` only.
- Environment file: `/home/alex/pour-n-art/shared/.env` (mode `600`).
- Activation backup: `/home/alex/pour-n-art/shared/.env.bak-before-aurora-activation-20260713-125141` (mode `600`).
- Previous deployment backup: `/home/alex/pour-n-art/shared/.env.bak-before-aurora-20260713-123728`.
- Application rollback release: `/home/alex/pour-n-art/releases/20260707-140449-shiprocket-f635983`.

The VPS is the active pilot environment. Deployment and rollback use the timestamped release directories, the atomic `current` symlink, and the single PM2 process named `pour-n-art`.

## Catalog-operations candidate — not deployed

The local `codex/aurora-catalog-operations` branch contains a twelve-product replacement pair. It is not active on the VPS and must not be copied into the current release independently.

- Aurora commit: `df5d6b3122fedf0890ed75435ad93c7c21eeed73`.
- Bundle SHA-256: `952c282b07fa272f3e86b2dea50bd8b66e9efd3cee558b42076638fa5ee5df7c`.
- Project fingerprint: `0f724ca61d7ea9ba5599d54b0b6a8f508082bf6c5beff6b66095f964e930ff2b`.
- Binding manifest fingerprint: `03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499`.
- Database changes: two additive migrations, still unapplied in production.

The active release and all activation evidence below continue to describe the existing eight-product pilot. The candidate’s migration, backup, release, restart, activation, and evaluation steps remain behind the external-action gate in `AURORA_CATALOG_OPERATIONS.md`.

## Runtime and access controls

- SDK: unpublished `@aurora/sdk@1.0.0-pilot.1`, committed as a checksummed tarball.
- Bundle: `aurora-project` v1 project `project.pna.catalog-intelligence-pilot`.
- Runtime: server-only, immutable, process-reused, and isolated from storefront and checkout startup.
- Access: valid session, `ADMIN` role, and exact membership in `AURORA_PILOT_ADMIN_ALLOWLIST`.
- Active flag: `AURORA_PILOT_ENABLED=true`.
- Allowlist: one stable production admin user ID. The ID is kept in the mode-`600` environment file and is redacted in repository records.
- Cache: bounded process-local successful-result cache. A `pour-n-art` restart or bundle fingerprint change invalidates effective reuse.
- Persistence: no evaluation result persistence and no external cache.

No database migration or seed was run for deployment or activation.

## Controlled activation procedure

1. Confirm `current` resolves to the approved release and the source checkout matches the approved commit.
2. Record the PIDs for `pour-n-art`, `pullback`, `telegram-listener`, and `webfoot-api`.
3. Query only `User.id`, `User.name`, `User.email`, and `User.role` to identify the unique production `ADMIN`; never select password hashes or session material.
4. Copy `/home/alex/pour-n-art/shared/.env` to a timestamped, mode-`600` backup.
5. Set `AURORA_PILOT_ENABLED=true` and set `AURORA_PILOT_ADMIN_ALLOWLIST` to only the approved stable admin ID.
6. Do not run migrations or the seed process.
7. Run `pm2 restart pour-n-art --update-env`; do not use `pm2 restart all`.
8. Wait for `http://127.0.0.1:3001/` to return success.
9. Confirm all unrelated PM2 PIDs are unchanged.
10. Run the authorization, health, storefront, checkout, admin, canary, logging, and mutation checks below.

## Health and authorization checks

1. `GET /` and `GET /checkout` must return `200` locally and through `https://pournart.in`.
2. An unauthenticated `GET /admin` must redirect to `/login`.
3. An unauthenticated `GET /api/admin/aurora/health` must return generic `401` JSON without pilot details.
4. A valid non-admin session must receive generic `403` JSON with `NOT_ADMIN`.
5. A valid but non-allowlisted admin session must receive generic `403` JSON with `NOT_ALLOWLISTED`.
6. The allowlisted admin must receive `200 application/json` from `/api/admin/aurora/health`.
7. Health must report runtime `ok`, no issue codes, the expected SDK version, project ID, bundle checksum, compatibility versions, and project fingerprint.
8. `/api/aurora/health` must remain absent so no customer Aurora API exists.

Never print or store session cookies, JWTs, passwords, password hashes, or environment secrets while performing these checks.

## Activation evidence - 2026-07-13

- PM2 `pour-n-art`: PID `138643` before activation, PID `139393` after activation.
- Unrelated PM2 PIDs remained unchanged: `pullback` `134533`, `telegram-listener` `19571`, `webfoot-api` `19581`.
- Storefront and empty-cart checkout returned `200` after activation and after all evaluations.
- Authenticated admin dashboard and `/admin/intelligence` loaded successfully.
- SDK version: `1.0.0-pilot.1`.
- Bundle SHA-256: `0a3c80b5968b223309a249e7e91c1ee33a865c14c74e66d3fdd260f5bb873f5f`.
- Project ID: `project.pna.catalog-intelligence-pilot`.
- Project fingerprint: `152fffc7eabc54be771497037c815f6be5ab9c239acfcf65aef79c8c16f70d52`.
- Health issue codes: none.
- The Ocean-Inspired Gift Coaster Set canary returned five accepted deterministic Decisions, including the expected blocking care-guidance constraint.
- Canary evidence/provenance and advanced fingerprints expanded correctly in the admin UI.
- Repeated canary execution returned the same response hash, input fingerprint, and output fingerprint.
- The remaining seven products completed in preserved order with zero partial failures; their repeated responses were equivalent.
- No needs-review conflicts were returned. This is expected because the conflict fixture is excluded from the live RuleSet.
- All eight product row SHA-256 values and `updatedAt` values were unchanged after evaluation.
- Thirty-four Aurora log events were audited with zero forbidden matches for product names, product content, evidence, provenance/source values, cookies, sessions, tokens, or passwords.

The SDK cache returns the cached response for a repeated successful input fingerprint. The current SDK log contract emits a normal success event for both cache misses and cache hits and does not include an explicit `cacheHit` field; cache reuse is therefore established by the verified code path, identical fingerprint, bounded cache state, and equivalent repeated response rather than by a dedicated log property.

## Pilot result table

| Product | Exact slug | Result | Decisions | Blocking decisions | Needs-review conflicts |
| --- | --- | --- | ---: | ---: | ---: |
| Ocean-Inspired Gift Coaster Set | `ocean-bloom-coaster-set` | Success | 5 | 1 | 0 |
| Botanical Welcome Name Plate | `floral-ocean-name-plate` | Success | 7 | 3 | 0 |
| Blush Petal Memory Tray | `blush-petal-resin-tray` | Success | 6 | 1 | 0 |
| Golden Aura Devotional Keepsake | `golden-aura-devotional-keepsake` | Success | 5 | 1 | 0 |
| Memory Keepsake Frame | `memory-resin-frame` | Success | 7 | 4 | 0 |
| Initial Charm Everyday Keepsake | `initial-charm-keychain-pair` | Success | 4 | 0 | 0 |
| Custom Wedding Ring Platter | `custom-wedding-ring-platter` | Success | 7 | 4 | 0 |
| Everyday Gift Custom Slot | `collaboration-custom-order` | Success | 5 | 3 | 0 |

No unexpected Decisions or product mutations were observed.

## Logging and customer boundary

- Logs may contain operational database IDs, binding IDs, artifact IDs, issue codes, fingerprints, stages, and duration.
- Logs must not contain product names or content, ProductDNA values, evidence, provenance/source values, customer data, cookies, session data, tokens, or secrets.
- Aurora APIs remain under `/api/admin/aurora/*` and independently enforce flag, session, role, and allowlist checks.
- No customer Aurora route or customer-visible Aurora UI is authorized.

## Rollback

Emergency isolation:

1. Back up the active environment file.
2. Set `AURORA_PILOT_ENABLED=false`.
3. Run `pm2 restart pour-n-art --update-env` only.
4. Confirm unrelated PM2 PIDs are unchanged.
5. Verify storefront, checkout, admin, and disabled Aurora health behavior.

Application rollback:

1. Set `AURORA_PILOT_ENABLED=false` and restart only `pour-n-art`.
2. Atomically repoint `/home/alex/pour-n-art/current` to `/home/alex/pour-n-art/releases/20260707-140449-shiprocket-f635983`.
3. Restart only `pour-n-art`.
4. Repeat storefront, checkout, admin, and disabled-health smoke checks.

Bundle rollback must restore the prior committed bundle and matching deployment manifest/checksum as one release. Never replace only the JSON bundle or only its checksum.

## Pilot failure criteria

Immediately disable the pilot and restart only `pour-n-art` on authorization bypass, checksum or compatibility failure, identity ambiguity, initialization failure, non-Aurora regression, privacy-unsafe logging, unexplained nondeterminism, product mutation, unavailable rollback input, or a new high/critical vulnerability. Do not continue product evaluation after any such failure.
