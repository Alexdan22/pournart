import type { AuroraEvaluation } from "@prisma/client";
import {
  auroraBindingManifestFingerprint,
  auroraBindingManifestHealth,
  resolveAuroraBinding,
} from "./bindings";
import { buildEvaluationContextIdentity, inspectCustomizationSchema } from "./identity";
import type { AuroraCatalogProduct } from "./types";

export type BindingCoverageState =
  | "unbound"
  | "awaiting-review"
  | "active"
  | "stale"
  | "invalid"
  | "missing-product-dna"
  | "missing-ruleset";

export type EvaluationCoverageState =
  | "not-evaluated"
  | "current"
  | "stale"
  | "failed"
  | "current-with-latest-refresh-failure";

export type ReviewCoverageState = "new" | "accepted" | "needs-changes" | "resolved";

export type CoverageReadinessReason = Readonly<{ code: string; label: string }>;

export type AuroraCoverageItem = Readonly<{
  id: string;
  name: string;
  slug: string;
  binding: BindingCoverageState;
  evaluation: EvaluationCoverageState;
  review: ReviewCoverageState | null;
  ready: boolean;
  readinessReasons: readonly CoverageReadinessReason[];
  bindingId?: string;
  bindingFingerprint?: string;
  manifestFingerprint: string;
  productDnaArtifactId?: string;
  ruleSetArtifactId?: string;
}>;

export type AuroraCoverageTotals = Readonly<{
  products: number;
  binding: Readonly<Record<BindingCoverageState, number>>;
  evaluation: Readonly<Record<EvaluationCoverageState, number>>;
  review: Readonly<Record<ReviewCoverageState, number>>;
  ready: number;
}>;

export type CoverageEvaluation = Pick<
  AuroraEvaluation,
  "id" | "productIdAtExecution" | "status" | "applicationContextFingerprint" | "createdAt"
>;

export function buildAuroraCoverage(
  products: readonly AuroraCatalogProduct[],
  evaluations: readonly CoverageEvaluation[],
): { readonly items: readonly AuroraCoverageItem[]; readonly totals: AuroraCoverageTotals } {
  const histories = new Map<string, CoverageEvaluation[]>();
  for (const evaluation of evaluations) {
    const values = histories.get(evaluation.productIdAtExecution) ?? [];
    values.push(evaluation);
    histories.set(evaluation.productIdAtExecution, values);
  }
  for (const values of histories.values())
    values.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const items = products.map((product) => coverageItem(product, histories.get(product.id) ?? []));
  return Object.freeze({ items: Object.freeze(items), totals: totals(items) });
}

function coverageItem(
  product: AuroraCatalogProduct,
  history: readonly CoverageEvaluation[],
): AuroraCoverageItem {
  const resolution = resolveAuroraBinding(product);
  const bindingState = bindingCoverageState(resolution);
  const binding = resolution.binding ?? (resolution.ok ? resolution.binding : undefined);
  const reasons = readinessReasons(product, bindingState);
  const contextFingerprint =
    resolution.ok
      ? buildEvaluationContextIdentity(product, resolution.binding).applicationContextFingerprint
      : undefined;
  const successful = history.filter((item) => item.status === "SUCCEEDED");
  const currentSuccess = contextFingerprint
    ? successful.find((item) => item.applicationContextFingerprint === contextFingerprint)
    : undefined;
  const latest = history[0];
  const evaluation = evaluationCoverageState(latest, currentSuccess, successful.length > 0);
  return Object.freeze({
    id: product.id,
    name: product.name,
    slug: product.slug,
    binding: bindingState,
    evaluation,
    review: successful.length ? "new" : null,
    ready: reasons.length === 0,
    readinessReasons: Object.freeze(reasons),
    ...(binding
      ? {
          bindingId: binding.bindingId,
          bindingFingerprint: binding.entryFingerprint,
          productDnaArtifactId: binding.productDnaArtifactId,
          ruleSetArtifactId: binding.ruleSetArtifactId,
        }
      : {}),
    manifestFingerprint: auroraBindingManifestFingerprint,
  });
}

function bindingCoverageState(
  resolution: ReturnType<typeof resolveAuroraBinding>,
): BindingCoverageState {
  if (resolution.ok) return "active";
  if (resolution.state === "no-binding") return "unbound";
  if (resolution.state === "awaiting-review") return "awaiting-review";
  if (resolution.state === "stale-binding") return "stale";
  if (resolution.state === "missing-product-dna") return "missing-product-dna";
  if (resolution.state === "missing-ruleset") return "missing-ruleset";
  return "invalid";
}

function evaluationCoverageState(
  latest: CoverageEvaluation | undefined,
  currentSuccess: CoverageEvaluation | undefined,
  hasSuccess: boolean,
): EvaluationCoverageState {
  if (!latest) return "not-evaluated";
  if (currentSuccess)
    return latest.status === "FAILED" && latest.id !== currentSuccess.id
      ? "current-with-latest-refresh-failure"
      : "current";
  if (hasSuccess) return "stale";
  return "failed";
}

function readinessReasons(
  product: AuroraCatalogProduct,
  binding: BindingCoverageState,
): CoverageReadinessReason[] {
  const reasons: CoverageReadinessReason[] = [];
  if (!auroraBindingManifestHealth.ok)
    reasons.push(reason("BINDING_MANIFEST_INVALID", "Binding manifest is incompatible"));
  if (binding === "unbound") reasons.push(reason("BINDING_NOT_FOUND", "No exact-slug binding"));
  if (binding === "awaiting-review") reasons.push(reason("BINDING_AWAITING_REVIEW", "Binding awaits review"));
  if (binding === "stale") reasons.push(reason("BINDING_EXPECTED_ID_MISMATCH", "Expected database ID mismatch"));
  if (binding === "invalid") reasons.push(reason("BINDING_INVALID", "Binding is invalid"));
  if (binding === "missing-product-dna")
    reasons.push(reason("PRODUCT_DNA_MISSING", "ProductDNA artifact is missing"));
  if (binding === "missing-ruleset")
    reasons.push(reason("RULESET_MISSING", "RuleSet artifact is missing"));
  if (product.adminStatus !== "PUBLISHED")
    reasons.push(reason("PRODUCT_NOT_PUBLISHED", "Product is not published"));
  if (!product.isActive || product.archivedAt)
    reasons.push(reason("PRODUCT_INACTIVE", "Product is inactive or archived"));
  if (product.inventory <= 0) reasons.push(reason("INVENTORY_UNAVAILABLE", "Inventory is unavailable"));
  if (product.handmadeDaysMin < 0 || product.handmadeDaysMax < product.handmadeDaysMin)
    reasons.push(reason("LEAD_TIME_INVALID", "Lead time is invalid"));
  if (!product.categoryId.trim()) reasons.push(reason("CATEGORY_MISSING", "Category is missing"));
  if (!product.description.trim()) reasons.push(reason("DESCRIPTION_MISSING", "Description is missing"));
  if (!product.story.trim()) reasons.push(reason("STORY_MISSING", "Story is missing"));
  if (!product.imageUrl.trim()) reasons.push(reason("IMAGE_MISSING", "Image is missing"));
  if (!inspectCustomizationSchema(product.customizationFields).valid)
    reasons.push(reason("CUSTOMIZATION_SCHEMA_INVALID", "Customization schema is invalid"));
  return reasons;
}

function totals(items: readonly AuroraCoverageItem[]): AuroraCoverageTotals {
  const binding = countStates<BindingCoverageState>([
    "unbound",
    "awaiting-review",
    "active",
    "stale",
    "invalid",
    "missing-product-dna",
    "missing-ruleset",
  ]);
  const evaluation = countStates<EvaluationCoverageState>([
    "not-evaluated",
    "current",
    "stale",
    "failed",
    "current-with-latest-refresh-failure",
  ]);
  const review = countStates<ReviewCoverageState>(["new", "accepted", "needs-changes", "resolved"]);
  for (const item of items) {
    binding[item.binding] += 1;
    evaluation[item.evaluation] += 1;
    if (item.review) review[item.review] += 1;
  }
  return Object.freeze({
    products: items.length,
    binding: Object.freeze(binding),
    evaluation: Object.freeze(evaluation),
    review: Object.freeze(review),
    ready: items.filter((item) => item.ready).length,
  });
}

function countStates<T extends string>(states: readonly T[]) {
  return Object.fromEntries(states.map((state) => [state, 0])) as Record<T, number>;
}

function reason(code: string, label: string): CoverageReadinessReason {
  return Object.freeze({ code, label });
}
