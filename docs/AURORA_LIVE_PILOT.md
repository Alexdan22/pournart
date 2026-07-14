# Aurora Live Pilot - controlled VPS operation

## Current production state

- Environment: Pour n Art production VPS, accessed through SSH host alias `my_vps`.
- Application root: `/home/alex/pour-n-art`.
- Active release: `/home/alex/pour-n-art/releases/20260714-074049-catalog-operations-281148d`.
- Deployed source commit: `281148d580adc92dca8200bc857df26970ebb154`.
- Process manager: PM2, one `fork` process named `pour-n-art`.
- Shared database: `/home/alex/pour-n-art/shared/pour-n-art.db`, SQLite `DELETE` journal mode.
- Shared environment: `/home/alex/pour-n-art/shared/.env`, mode `600`.
- Aurora pilot flag: disabled after the 2026-07-14 Stage 7 identity-reporting gate failed.
- Allowlist: exactly one stable production admin ID, retained only in the protected environment file.
- Application and bundle rollback release: `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9`.

The twelve-product bundle and versioned binding manifest are installed together in the active release, and the two catalog-operations migrations are applied. Aurora cannot execute while the feature flag is disabled. Storefront, checkout, admin, and unrelated PM2 processes remain healthy.

## Installed artifact identity

- Aurora source commit: `df5d6b3122fedf0890ed75435ad93c7c21eeed73`.
- SDK: unpublished `@aurora/sdk@1.0.0-pilot.1`.
- SDK tarball SHA-256: `d526876e13c4e2fcb869bb51e351c8015a84ddc942f948d81cb914d4db701283`.
- Project: `project.pna.catalog-intelligence-pilot`, `aurora-project` v1.
- Bundle SHA-256: `952c282b07fa272f3e86b2dea50bd8b66e9efd3cee558b42076638fa5ee5df7c`.
- Project fingerprint: `0f724ca61d7ea9ba5599d54b0b6a8f508082bf6c5beff6b66095f964e930ff2b`.
- Binding-manifest file SHA-256: `7e627fe96f82774bfc75d7fdab99ebb6a23c516e238712b9b6579c62a6747c43`.
- Binding-manifest fingerprint: `03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499`.
- Coverage: twelve active exact-slug bindings, no fuzzy binding, no expected database ID override.

## 2026-07-14 deployment evidence

The exact pushed source commit passed 58 tests, including three accessibility scans, lint, artifact/runtime validation, and a Next.js 16.2.9 production build. The first build reached TypeScript but exhausted Node's default heap; a single bounded retry with `NODE_OPTIONS=--max-old-space-size=1024` passed. The standalone release contains no copied `.env` and reads only the shared environment through `/home/alex/pour-n-art/run.sh`.

Backups and rehearsal:

- Environment backup before rollout: `/home/alex/pour-n-art/shared/.env.bak-before-catalog-operations-20260714T072500Z`, SHA-256 `a92fc6fd72b8951ea6609c15d45934a88df137af57f85a59eced47753718f1e3`.
- Environment backup before disabled cutover: `/home/alex/pour-n-art/shared/.env.bak-before-disabled-cutover-20260714T074250Z`, the same SHA-256.
- Environment backup before activation attempt: `/home/alex/pour-n-art/shared/.env.bak-before-catalog-activation-20260714T074730Z`, SHA-256 `3cab4e4a75ceae38fea25625a32673f900979c5fedaffe831afbb4cbdb449fa3`.
- Online database backup: `/home/alex/pour-n-art/backups/sqlite/pour-n-art-manual-20260714T072500Z.db`, SHA-256 `cd915015eb91355b5732e0b6312c22af0b0d1f03ec445db2c2589336c25fc0db`, 454,656 bytes, integrity `ok`.
- Quiesced database backup: `/home/alex/pour-n-art/backups/sqlite/pour-n-art-manual-20260714T074330Z.db`, same checksum and size, integrity `ok`, mode `600`.
- VPS-local migration rehearsal: both migrations applied to a restored copy, resulting SHA-256 `b45bc9d4534d54e88cf04ffba9e619ac700f64eea5ccd9d1716e98d5b547d9e5`, 540,672 bytes, integrity `ok`; an independent restore retained the original backup checksum.
- Production migration: only `npm run db:deploy` ran; seed did not run. Eight migrations are applied, all three Aurora tables and 16 indexes exist, and database integrity is `ok`.
- Critical counts remained four users, twelve products, one order, one order item, and six categories.

Disabled smoke checks passed for storefront, product list/detail, empty-cart checkout, authenticated admin dashboard, orders, generic disabled Aurora health, absent customer Aurora route, database integrity, and process isolation.

## Activation gate result

The protected allowlist was verified as exactly the existing admin ID. The activation attempt produced the expected authorization behavior:

- Unauthenticated admin Aurora health: generic `401`.
- Authenticated non-admin: generic `403` with `NOT_ADMIN`.
- Authenticated non-allowlisted admin: generic `403` with `NOT_ALLOWLISTED`.
- Allowlisted admin: `200`.
- Customer Aurora route: `404`.

Runtime health reported initialization success, SDK `1.0.0-pilot.1`, the expected project ID, bundle checksum, project fingerprint, and no issue codes. The response did not include the required binding-manifest fingerprint. The Stage 7 fail-closed handler therefore set `AURORA_PILOT_ENABLED=false` and restarted only `pour-n-art`.

No canary or catalog evaluation ran. `AuroraEvaluation`, `AuroraEvaluationReview`, and `AuroraReviewEvent` each remain at zero rows. No product was modified, no review state was created, no backup schedule was installed, and the seven-day observation period did not begin. Temporary smoke credentials were deleted, and the audited PM2 log window had zero matches for cookie, password, bearer, authorization, session-cookie, or session-secret terms.

PM2 evidence:

- `pour-n-art`: PID `139393` before deployment, `167186` after disabled cutover, `167515` during activation, and `167697` after fail-closed disablement.
- `pullback`: PID `134533`, unchanged.
- `telegram-listener`: PID `19571`, unchanged.
- `webfoot-api`: PID `19581`, unchanged.

## Required correction before another activation

The authenticated health contract must expose and validate the loaded binding-manifest fingerprint. The correction must be implemented and tested locally, built into a new release, and separately approved for deployment. Do not enable Aurora, run a canary, evaluate the catalog, install the approved backup schedule, or begin the observation period before the corrected identity gate passes.

## Health and authorization procedure

1. Keep `AURORA_PILOT_ENABLED=false` until the corrected release is installed.
2. Confirm `current`, release commit, PM2 shape, database integrity, and rollback inputs.
3. Back up the protected environment before any flag change.
4. Restart only `pour-n-art`; never restart all PM2 processes.
5. Verify generic `401`/`403` behavior, exact allowlist success, absent customer endpoint, and every SDK, project, bundle, project-fingerprint, binding-manifest-fingerprint, and issue-code field.
6. On any mismatch, disable the flag and restart only `pour-n-art` before executing a product.

Never print or store session cookies, JWTs, passwords, password hashes, environment secrets, customer data, ProductDNA values, evidence, or provenance during checks.

## Rollback

Emergency isolation:

1. Back up the active environment file.
2. Set `AURORA_PILOT_ENABLED=false`.
3. Run `pm2 restart pour-n-art --update-env` only.
4. Confirm unrelated PM2 PIDs are unchanged.
5. Verify storefront, checkout, admin, disabled Aurora health, and database integrity.

Application and bundle rollback:

1. Keep Aurora disabled.
2. Atomically repoint `/home/alex/pour-n-art/current` to `/home/alex/pour-n-art/releases/20260713-071442-aurora-8b208c9`.
3. Restart only `pour-n-art`.
4. Repeat disabled smoke checks.

The additive catalog-operations tables may remain in place during application rollback. Do not restore an older database after customer traffic has resumed without a separately approved reconciliation plan. Bundle and binding manifest always roll back as one release pair.
