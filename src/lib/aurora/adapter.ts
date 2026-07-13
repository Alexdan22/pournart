import "server-only";

import { prisma } from "@/lib/db";
import { buildAuroraExplicitReferences } from "./assertions";
import { resolveAuroraBinding } from "./bindings";
import { loadAndEvaluateProduct } from "./evaluation";
import { auroraInitialization } from "./runtime";
import type { AuroraCatalogProduct, AuroraEvaluationView } from "./types";

const latestResults = new Map<string, AuroraEvaluationView>();

export async function evaluateProductIntelligence(productId: string): Promise<AuroraEvaluationView> {
  return loadAndEvaluateProduct(
    productId,
    (id) => prisma.product.findUnique({ where: { id } }),
    evaluateCatalogProduct,
  );
}

export function evaluateCatalogProduct(product: AuroraCatalogProduct): AuroraEvaluationView {
  const resolved = resolveAuroraBinding(product);
  if (!resolved.ok)
    return { state: resolved.state, message: resolved.message, productId: product.id };
  if (!auroraInitialization.ok)
    return {
      state: "runtime-failure",
      message: "Aurora is unavailable because its validated project could not be initialized.",
      productId: product.id,
      health: auroraInitialization.health,
    };
  const response = auroraInitialization.service.execute({
    ruleSet: { kind: "ruleset", artifactId: resolved.binding.ruleSetArtifactId },
    product: { kind: "product-dna", artifactId: resolved.binding.productDnaArtifactId },
    explicitReferences: buildAuroraExplicitReferences(product, resolved.binding),
  });
  console.info(
    JSON.stringify({
      event: "aurora.product-evaluation",
      productId: product.id,
      bindingId: resolved.binding.bindingId,
      projectId: resolved.binding.projectId,
      artifactIds: [resolved.binding.productDnaArtifactId, resolved.binding.ruleSetArtifactId],
      stage: response.ok ? "success" : response.stage,
    }),
  );
  if (!response.ok) {
    const failure: AuroraEvaluationView = {
      state: "validation-failure",
      message: "Aurora could not validate or execute this approved product binding.",
      productId: product.id,
      binding: resolved.binding,
      response,
    };
    remember(product.id, failure);
    return failure;
  }
  const success: AuroraEvaluationView = {
    state: "success",
    productId: product.id,
    slug: product.slug,
    productName: product.name,
    binding: resolved.binding,
    response,
    health: auroraInitialization.health,
    evaluatedAt: new Date().toISOString(),
  };
  remember(product.id, success);
  return success;
}

export function getLatestProductIntelligence(productId: string) {
  return latestResults.get(productId);
}

export function clearLatestProductIntelligence() {
  latestResults.clear();
}

function remember(productId: string, value: AuroraEvaluationView) {
  if (!latestResults.has(productId) && latestResults.size >= 200) {
    const oldest = latestResults.keys().next().value;
    if (oldest) latestResults.delete(oldest);
  }
  latestResults.set(productId, value);
}
