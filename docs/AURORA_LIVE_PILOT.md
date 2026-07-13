# Aurora Live Pilot — controlled Render preparation

## Deployment inputs

- SDK: unpublished `@aurora/sdk@1.0.0-pilot.1`, committed as a checksummed tarball.
- Bundle: `aurora-project` v1 project `project.pna.catalog-intelligence-pilot`.
- Runtime: server-only, immutable, process-reused, and isolated from storefront/checkout startup.
- Access: `ADMIN` session plus `AURORA_PILOT_ADMIN_ALLOWLIST`.
- Flag: `AURORA_PILOT_ENABLED=false` by default.
- Cache: bounded process-local successful-result cache; restart and bundle fingerprint changes invalidate effective reuse.

Run `npm run aurora:validate`, `npm test`, `npm run lint`, and `npm run build` before any deployment.

## Render SQLite identity verification

The checked-in Render service mounts a persistent disk at `/var/data` and uses `DATABASE_URL=file:/var/data/pour-n-art.db`. Startup runs `prisma migrate deploy`, `prisma db seed`, then Next.js. The seed uses `Product.upsert({ where: { slug } })`; an existing product is updated without replacing its primary key, so IDs are preserved across ordinary deploys while the persistent disk and record remain intact.

IDs are not guaranteed across disk replacement, manual deletion/recreation, a new Render service, or database restoration that recreates rows. Therefore the pilot remains slug-first. API product IDs only locate the current record and appear in provenance/logs. An optional configured expected ID can add an environment check but never becomes the primary binding key.

## Deployment order (external approval required)

1. Confirm both approved local repository commits and artifact checksums in the cross-repository manifest.
2. Confirm the previous Pour n Art deploy commit and previous valid bundle are available.
3. Push the approved branches only after the external-action gate is approved.
4. Deploy with `AURORA_PILOT_ENABLED=false`; do not set the allowlist yet.
5. Confirm `/`, storefront product, cart, checkout, and unrelated admin pages operate normally.
6. As an existing admin, inspect the protected Aurora health endpoint after configuring a temporary allowlist.
7. Set the allowlist to the approved admin IDs/emails; keep the flag disabled until health is valid.
8. Enable the flag, restart through Render’s normal deploy/restart control, and evaluate one bound product.
9. Evaluate the remaining seven pilot products from `/admin/intelligence` and monitor structured Render logs.

No environment change, restart, deployment, or production evaluation is authorized by this document.

## Smoke and acceptance checks

- Storefront, checkout, payment, shipping, email, and unrelated admin workflows are unchanged.
- Customer routes contain no Aurora endpoint or UI.
- Unauthorized, non-admin, non-allowlisted, and disabled requests cannot obtain health or intelligence data.
- Product execution shows outcome-first Decisions and expandable evidence/provenance.
- Catalog evaluation enforces 25 items maximum and concurrency four with partial failures.
- Logs contain operational IDs, issue codes, fingerprints, cache/timing data only; they contain no product content, evidence, source values, session data, or customer data.
- Invalid SDK/bundle checksum, project identity, format, or fingerprint returns Aurora `503`/unavailable states without affecting unrelated routes.

## Rollback

Application rollback: select the previous known-good Render deploy/commit, keep `AURORA_PILOT_ENABLED=false`, deploy it, and repeat non-Aurora smoke checks.

Bundle rollback: restore the prior committed bundle plus its matching deployment manifest/checksum as one change, validate locally, deploy with the flag disabled, verify protected health, then re-enable only after approval. Never replace only the JSON bundle or only its checksum.

Emergency isolation: set `AURORA_PILOT_ENABLED=false`. This blocks all pilot APIs/UI actions while leaving storefront and unrelated admin functions available.

## Pilot failure criteria

Stop or disable the pilot on authorization bypass, checksum/compatibility failure, identity ambiguity, non-Aurora regression, privacy-unsafe logging, unexplained nondeterminism, unavailable rollback input, or any new high/critical vulnerability.
