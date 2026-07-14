import { AuroraCatalogWorkspace, type AuroraCatalogItem } from "@/components/aurora-catalog-workspace";
import { currentAuroraAccess } from "@/lib/aurora/access";
import { auroraBindingManifestHealth } from "@/lib/aurora/bindings";
import { buildAuroraCoverage } from "@/lib/aurora/coverage";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function AdminIntelligencePage() {
  const access = currentAuroraAccess(await getSession());
  const [products, evaluations, reviews] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ updatedAt: "desc" }, { name: "asc" }] }),
    prisma.auroraEvaluation.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        productIdAtExecution: true,
        status: true,
        applicationContextFingerprint: true,
        createdAt: true,
      },
    }),
    prisma.auroraEvaluationReview.findMany({
      where: { targetKey: "evaluation" },
      select: { evaluationId: true, targetKey: true, state: true },
    }),
  ]);
  const coverage = buildAuroraCoverage(products, evaluations, reviews);
  const items: AuroraCatalogItem[] = coverage.items.map((item) => ({
    ...item,
    state:
      item.evaluation === "current"
        ? "success"
        : item.evaluation === "failed"
          ? "invalid"
          : item.evaluation === "not-evaluated"
            ? "not-evaluated"
            : item.evaluation === "current-with-latest-refresh-failure"
              ? "invalid"
              : "invalid",
  }));
  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Aurora Intelligence</span>
          <h1>Catalog intelligence</h1>
          <p>Review exact binding, evaluation, and review coverage without modifying catalog records.</p>
        </div>
      </div>
      {access.ok ? (
        <>
          <section className="admin-stats" aria-label="Intelligence coverage totals">
            <CoverageStat label="Catalog products" value={coverage.totals.products} />
            <CoverageStat label="Active bindings" value={coverage.totals.binding.active} />
            <CoverageStat label="Ready products" value={coverage.totals.ready} />
            <CoverageStat label="Current evaluations" value={coverage.totals.evaluation.current} />
            <CoverageStat label="Stale evaluations" value={coverage.totals.evaluation.stale} />
            <CoverageStat label="Failed evaluations" value={coverage.totals.evaluation.failed} />
          </section>
          <section className="admin-panel" aria-labelledby="aurora-release-pair-title">
            <div className="admin-panel-heading">
              <div>
                <span>Read-only compatibility preview</span>
                <h2 id="aurora-release-pair-title">Repository release pair</h2>
              </div>
              <span className={`aurora-state ${auroraBindingManifestHealth.ok ? "success" : "invalid"}`}>
                {auroraBindingManifestHealth.ok ? "Compatible" : "Invalid"}
              </span>
            </div>
            <dl className="aurora-detail-grid">
              <div><dt>Manifest</dt><dd>{auroraBindingManifestHealth.manifestId ?? "Invalid manifest"}</dd></div>
              <div><dt>Manifest fingerprint</dt><dd><code>{auroraBindingManifestHealth.manifestFingerprint ?? "unavailable"}</code></dd></div>
              <div><dt>Bundle checksum</dt><dd><code>{auroraBindingManifestHealth.bundleSha256}</code></dd></div>
              <div><dt>Bundle fingerprint</dt><dd><code>{auroraBindingManifestHealth.bundleFingerprint}</code></dd></div>
              <div><dt>Binding entries</dt><dd>{auroraBindingManifestHealth.entryCount}</dd></div>
              <div><dt>Bundle artifacts</dt><dd>{auroraBindingManifestHealth.productDnaCount} ProductDNA / {auroraBindingManifestHealth.ruleSetCount} RuleSet</dd></div>
            </dl>
            {auroraBindingManifestHealth.issueCodes.length ? (
              <p role="alert">Compatibility blockers: {auroraBindingManifestHealth.issueCodes.join(", ")}</p>
            ) : (
              <p>This preview is read-only. Activation requires a reviewed repository commit containing the bundle and manifest as one release pair.</p>
            )}
          </section>
          <AuroraCatalogWorkspace initialItems={items} />
        </>
      ) : (
        <div className="admin-panel">
          <h2>Pilot access unavailable</h2>
          <p>This workspace is disabled or your admin account is not allowlisted.</p>
        </div>
      )}
    </section>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
