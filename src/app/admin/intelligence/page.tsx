import { AuroraCatalogWorkspace, type AuroraCatalogItem } from "@/components/aurora-catalog-workspace";
import { currentAuroraAccess } from "@/lib/aurora/access";
import { getLatestProductIntelligence } from "@/lib/aurora/adapter";
import { resolveAuroraBinding } from "@/lib/aurora/bindings";
import { summarizeAuroraEvaluation } from "@/lib/aurora/catalog-state";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function AdminIntelligencePage() {
  const access = currentAuroraAccess(await getSession());
  const products = await prisma.product.findMany({ orderBy: [{ updatedAt: "desc" }, { name: "asc" }] });
  const items: AuroraCatalogItem[] = products.map((product) => {
    const binding = resolveAuroraBinding(product);
    const blockers = [
      ...(product.adminStatus === "PUBLISHED" ? [] : ["Not published"]),
      ...(product.isActive && !product.archivedAt ? [] : ["Inactive"]),
      ...(product.inventory > 0 ? [] : ["No inventory"]),
      ...(product.handmadeDaysMin >= 0 && product.handmadeDaysMax >= product.handmadeDaysMin ? [] : ["Invalid lead time"]),
    ];
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      bound: binding.ok,
      productDnaPresent: binding.ok,
      ready: binding.ok && blockers.length === 0,
      blockers,
      state: binding.ok ? summarizeAuroraEvaluation(getLatestProductIntelligence(product.id)) : "unbound",
    };
  });
  return (
    <section className="admin-route">
      <div className="admin-page-heading"><div><span>Aurora Intelligence</span><h1>Catalog intelligence</h1><p>Evaluate selected products safely without modifying catalog records.</p></div></div>
      {access.ok ? <AuroraCatalogWorkspace initialItems={items} /> : <div className="admin-panel"><h2>Pilot access unavailable</h2><p>This workspace is disabled or your admin account is not allowlisted.</p></div>}
    </section>
  );
}
