import type { AuroraEvaluation } from "@prisma/client";
import type { AuroraProductBinding } from "./bindings";
import { currentAuroraArtifactFingerprint } from "./bindings";
import {
  auroraDeploymentIdentity,
  type EvaluationContextIdentity,
} from "./identity";
import type { AuroraCatalogProduct, AuroraLifecycle } from "./types";

type Snapshot = {
  productId?: unknown;
  slug?: unknown;
  adminStatus?: unknown;
  active?: unknown;
  archived?: unknown;
  inventoryAvailable?: unknown;
  leadTime?: unknown;
  requiredContent?: unknown;
  customizationSchema?: unknown;
  approvedExplicitFacts?: unknown;
};

export function deriveEvaluationLifecycle(input: {
  evaluation: AuroraEvaluation;
  product: AuroraCatalogProduct | null;
  binding: AuroraProductBinding | null;
  context: EvaluationContextIdentity | null;
  bindingIssue?: "no-binding" | "awaiting-review" | "stale-binding" | "invalid-binding" | "missing-product-dna" | "missing-ruleset";
  newerSuccess?: AuroraEvaluation | null;
  latestFailure?: AuroraEvaluation | null;
}): AuroraLifecycle {
  const reasons: { code: string; label: string }[] = [];
  const stored = parseSnapshot(input.evaluation.inputSnapshotJson);
  const current = input.context ? parseSnapshot(input.context.inputSnapshotJson) : undefined;
  if (!input.product) add(reasons, "PRODUCT_DELETED", "The product no longer exists.");
  else {
    compare(reasons, stored.slug, input.product.slug, "PRODUCT_SLUG_CHANGED", "The exact product slug changed.");
    if (current) {
      compare(reasons, stored.adminStatus, current.adminStatus, "PUBLICATION_STATUS_CHANGED", "Publication status changed.");
      compare(reasons, stored.active, current.active, "ACTIVE_STATE_CHANGED", "Active state changed.");
      compare(reasons, stored.archived, current.archived, "ARCHIVE_STATE_CHANGED", "Archive state changed.");
      compare(reasons, stored.inventoryAvailable, current.inventoryAvailable, "INVENTORY_AVAILABILITY_CHANGED", "Inventory crossed the available/unavailable boundary.");
      compare(reasons, stored.leadTime, current.leadTime, "LEAD_TIME_CHANGED", "Lead-time values changed.");
      compare(reasons, stored.requiredContent, current.requiredContent, "CONTENT_COMPLETENESS_CHANGED", "Required content presence changed.");
      compare(reasons, stored.customizationSchema, current.customizationSchema, "CUSTOMIZATION_SCHEMA_CHANGED", "The canonical customization schema changed.");
      compare(reasons, stored.approvedExplicitFacts, current.approvedExplicitFacts, "APPROVED_FACTS_CHANGED", "Approved explicit facts changed.");
    }
  }
  if (!input.binding) {
    if (input.bindingIssue === "stale-binding")
      add(reasons, "BINDING_EXPECTED_ID_MISMATCH", "The environment-specific expected database ID differs.");
    else if (input.bindingIssue === "awaiting-review")
      add(reasons, "BINDING_AWAITING_REVIEW", "The exact binding awaits human review.");
    else if (input.bindingIssue === "missing-product-dna")
      add(reasons, "PRODUCT_DNA_MISSING", "The selected ProductDNA artifact is missing.");
    else if (input.bindingIssue === "missing-ruleset")
      add(reasons, "RULESET_MISSING", "The selected RuleSet artifact is missing.");
    else add(reasons, "BINDING_UNRESOLVED", "The exact-slug binding is unresolved.");
  }
  else {
    compare(reasons, input.evaluation.bindingId, input.binding.bindingId, "BINDING_CHANGED", "The selected binding changed.");
    compare(reasons, input.evaluation.bindingFingerprint, input.binding.entryFingerprint, "BINDING_FINGERPRINT_CHANGED", "The binding entry changed.");
    compare(reasons, input.evaluation.productDnaArtifactId, input.binding.productDnaArtifactId, "PRODUCT_DNA_CHANGED", "The ProductDNA selection changed.");
    compare(reasons, input.evaluation.productDnaProductId, input.binding.productDnaProductId, "PRODUCT_DNA_CHANGED", "The ProductDNA identity changed.");
    compare(reasons, input.evaluation.productDnaFingerprint, currentAuroraArtifactFingerprint(input.binding.productDnaArtifactId), "PRODUCT_DNA_CHANGED", "The ProductDNA artifact changed.");
    compare(reasons, input.evaluation.ruleSetArtifactId, input.binding.ruleSetArtifactId, "RULESET_CHANGED", "The RuleSet selection changed.");
    compare(reasons, input.evaluation.ruleSetDomainId, input.binding.ruleSetDomainId, "RULESET_CHANGED", "The RuleSet identity changed.");
    compare(reasons, input.evaluation.ruleSetFingerprint, currentAuroraArtifactFingerprint(input.binding.ruleSetArtifactId), "RULESET_CHANGED", "The RuleSet artifact changed.");
    compare(reasons, input.evaluation.projectId, input.binding.projectId, "PROJECT_CHANGED", "The Aurora project selection changed.");
  }
  if (input.context)
    compare(reasons, input.evaluation.bindingManifestFingerprint, input.context.bindingManifestFingerprint, "BINDING_MANIFEST_CHANGED", "The binding manifest changed.");
  compare(reasons, input.evaluation.bundleFingerprint, auroraDeploymentIdentity.bundleFingerprint, "BUNDLE_CHANGED", "The Aurora bundle changed.");
  compare(reasons, input.evaluation.bundleSha256, auroraDeploymentIdentity.bundleSha256, "BUNDLE_CHANGED", "The Aurora bundle checksum changed.");
  compare(reasons, input.evaluation.sdkVersion, auroraDeploymentIdentity.sdkVersion, "SDK_CHANGED", "The Aurora SDK version changed.");
  if (input.context) {
    compare(reasons, input.evaluation.runtimeContractsJson, input.context.runtimeContractsJson, "RUNTIME_CONTRACT_CHANGED", "Runtime compatibility contracts changed.");
  }
  const lifecycle: AuroraLifecycle = {
    state: input.newerSuccess ? "superseded" : reasons.length ? "stale" : "current",
    staleReasons: Object.freeze(reasons),
    ...(input.latestFailure && input.latestFailure.createdAt > input.evaluation.createdAt
      ? {
          latestRefreshFailure: Object.freeze({
            evaluationId: input.latestFailure.id,
            evaluatedAt: input.latestFailure.createdAt.toISOString(),
            issueCodes: failureCodes(input.latestFailure.issueCodesJson),
          }),
        }
      : {}),
  };
  return Object.freeze(lifecycle);
}

function parseSnapshot(value: string): Snapshot {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Snapshot : {};
  } catch {
    return {};
  }
}

function compare(reasons: { code: string; label: string }[], left: unknown, right: unknown, code: string, label: string) {
  if (JSON.stringify(left) !== JSON.stringify(right)) add(reasons, code, label);
}

function add(reasons: { code: string; label: string }[], code: string, label: string) {
  if (!reasons.some((reason) => reason.code === code)) reasons.push({ code, label });
}

function failureCodes(value: string): readonly string[] {
  try {
    const parsed = JSON.parse(value);
    return Object.freeze(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return Object.freeze([]);
  }
}
