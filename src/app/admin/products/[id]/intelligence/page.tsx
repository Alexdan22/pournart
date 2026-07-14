import Link from "next/link";
import { AuroraIntelligencePanel } from "@/components/aurora-intelligence-panel";
import { currentAuroraAccess } from "@/lib/aurora/access";
import { getLatestProductIntelligence } from "@/lib/aurora/adapter";
import { resolveAuroraBinding } from "@/lib/aurora/bindings";
import { auroraInitialization } from "@/lib/aurora/runtime";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function ProductIntelligencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true, slug: true } });
  const access = currentAuroraAccess(await getSession());
  let state: Parameters<typeof AuroraIntelligencePanel>[0]["initialState"];
  if (!access.ok) state = { state: "authorization-failure", message: "This pilot is disabled or your admin account is not allowlisted." };
  else if (!product) state = { state: "missing-product", message: "This product no longer exists.", productId: id };
  else {
    const binding = resolveAuroraBinding(product);
    if (!binding.ok) state = { state: binding.state, message: binding.message, productId: product.id };
    else if (!auroraInitialization.ok) state = { state: "runtime-failure", message: "The Aurora bundle did not pass initialization.", productId: product.id, health: auroraInitialization.health };
    else state = await getLatestProductIntelligence(product.id) ?? { state: "not-evaluated", message: "The binding and runtime are valid. Execute Aurora to see current Decisions." };
  }
  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div><span>Products / Intelligence</span><h1>{product?.name ?? "Missing product"}</h1><p>{product?.slug ?? id}</p></div>
        <Link className="admin-button ghost" href="/admin/products">Back to products</Link>
      </div>
      <AuroraIntelligencePanel productId={id} initialState={state} />
    </section>
  );
}
