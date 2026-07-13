export type ApprovedExplicitFact =
  | "pilot.premium-presentation.approved"
  | "pilot.care-guidance.required"
  | "pilot.admin-review.required";

export type AuroraProductBinding = Readonly<{
  bindingId: string;
  expectedSlug: string;
  expectedProductId?: string;
  projectId: "project.pna.catalog-intelligence-pilot";
  projectArtifactId: string;
  productDnaArtifactId: string;
  productDnaProductId: string;
  ruleSetArtifactId: "artifact.pna.ruleset.catalog-readiness";
  ruleSetDomainId: "ruleset.pna.catalog-readiness";
  approvedExplicitFacts: readonly ApprovedExplicitFact[];
}>;

const common = {
  projectId: "project.pna.catalog-intelligence-pilot",
  ruleSetArtifactId: "artifact.pna.ruleset.catalog-readiness",
  ruleSetDomainId: "ruleset.pna.catalog-readiness",
} as const;

function binding(slug: string, approvedExplicitFacts: readonly ApprovedExplicitFact[]): AuroraProductBinding {
  return Object.freeze({
    ...common,
    bindingId: `binding.pna.${slug}`,
    expectedSlug: slug,
    projectArtifactId: `artifact.pna.product.${slug}`,
    productDnaArtifactId: `artifact.pna.product.${slug}`,
    productDnaProductId: `product.pna.${slug}`,
    approvedExplicitFacts: Object.freeze([...approvedExplicitFacts]),
  });
}

export const auroraProductBindings = Object.freeze([
  binding("ocean-bloom-coaster-set", ["pilot.care-guidance.required"]),
  binding("floral-ocean-name-plate", ["pilot.premium-presentation.approved", "pilot.care-guidance.required", "pilot.admin-review.required"]),
  binding("blush-petal-resin-tray", ["pilot.premium-presentation.approved", "pilot.care-guidance.required"]),
  binding("golden-aura-devotional-keepsake", ["pilot.care-guidance.required"]),
  binding("memory-resin-frame", ["pilot.premium-presentation.approved", "pilot.care-guidance.required", "pilot.admin-review.required"]),
  binding("initial-charm-keychain-pair", []),
  binding("custom-wedding-ring-platter", ["pilot.premium-presentation.approved", "pilot.care-guidance.required", "pilot.admin-review.required"]),
  binding("collaboration-custom-order", ["pilot.admin-review.required"]),
]);

const bindingBySlug = new Map(auroraProductBindings.map((item) => [item.expectedSlug, item]));

export type BindingResolution =
  | { readonly ok: true; readonly binding: AuroraProductBinding }
  | { readonly ok: false; readonly state: "no-binding" | "stale-binding"; readonly message: string };

export function resolveAuroraBinding(product: { id: string; slug: string }): BindingResolution {
  const candidate = bindingBySlug.get(product.slug);
  if (!candidate)
    return { ok: false, state: "no-binding", message: "No Aurora binding exists for this exact product slug." };
  return validateAuroraBinding(candidate, product);
}

export function validateAuroraBinding(
  candidate: AuroraProductBinding,
  product: { id: string; slug: string },
): BindingResolution {
  if (candidate.expectedSlug !== product.slug)
    return { ok: false, state: "no-binding", message: "The exact configured product slug does not match this record." };
  if (candidate.expectedProductId && candidate.expectedProductId !== product.id)
    return { ok: false, state: "stale-binding", message: "The configured environment-specific product ID does not match this record." };
  return { ok: true, binding: candidate };
}
