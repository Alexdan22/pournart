import type { AuroraEvaluation } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { auroraProductBindings, currentAuroraArtifactFingerprint } from "./bindings";
import { auroraDeploymentIdentity, buildEvaluationContextIdentity } from "./identity";
import { deriveEvaluationLifecycle } from "./lifecycle";
import type { AuroraCatalogProduct } from "./types";

const binding = auroraProductBindings.find((item) => item.expectedSlug === "ocean-bloom-coaster-set")!;

describe("Aurora evaluation lifecycle", () => {
  it("keeps non-relevant catalog changes current", () => {
    const original = product();
    const context = buildEvaluationContextIdentity(original, binding);
    const changed = {
      ...original,
      name: "Renamed",
      inventory: 99,
      price: 999,
      compareAtPrice: 1200,
      isFeatured: true,
      lowStockThreshold: 50,
      updatedAt: new Date("2030-01-01"),
    };
    const currentContext = buildEvaluationContextIdentity(changed, binding);
    expect(currentContext.relevantInputFingerprint).toBe(context.relevantInputFingerprint);
    expect(deriveEvaluationLifecycle({
      evaluation: evaluation(original, context),
      product: changed,
      binding,
      context: currentContext,
    })).toMatchObject({ state: "current", staleReasons: [] });
  });

  it.each([
    ["exact slug", { slug: "renamed-product" }, "PRODUCT_SLUG_CHANGED"],
    ["publication", { adminStatus: "DRAFT" }, "PUBLICATION_STATUS_CHANGED"],
    ["active", { isActive: false }, "ACTIVE_STATE_CHANGED"],
    ["archive", { archivedAt: new Date("2026-07-14") }, "ARCHIVE_STATE_CHANGED"],
    ["availability", { inventory: 0 }, "INVENTORY_AVAILABILITY_CHANGED"],
    ["lead time", { handmadeDaysMax: 12 }, "LEAD_TIME_CHANGED"],
    ["content presence", { story: "" }, "CONTENT_COMPLETENESS_CHANGED"],
    ["customization", { customizationFields: '[{"label":"Text","name":"text","type":"text"}]' }, "CUSTOMIZATION_SCHEMA_CHANGED"],
  ])("marks %s changes stale", (_label, change, code) => {
    const original = product();
    const storedContext = buildEvaluationContextIdentity(original, binding);
    const changed = { ...original, ...change };
    const lifecycle = deriveEvaluationLifecycle({
      evaluation: evaluation(original, storedContext),
      product: changed,
      binding,
      context: buildEvaluationContextIdentity(changed, binding),
    });
    expect(lifecycle.state).toBe("stale");
    expect(lifecycle.staleReasons.map((reason) => reason.code)).toContain(code);
  });

  it("treats canonical customization key order and nonempty content replacements as non-staling", () => {
    const original = product();
    const context = buildEvaluationContextIdentity(original, binding);
    const changed = {
      ...original,
      categoryId: "another-category",
      description: "Replacement",
      story: "Replacement",
      imageUrl: "/replacement.jpg",
      customizationFields: '[ { "type": "textarea", "label": "Notes", "name": "notes" } ]',
    };
    const currentContext = buildEvaluationContextIdentity(changed, binding);
    expect(currentContext.relevantInputFingerprint).toBe(context.relevantInputFingerprint);
  });

  it("derives deleted, bundle, SDK, runtime, superseded, and latest-failure state", () => {
    const original = product();
    const context = buildEvaluationContextIdentity(original, binding);
    const stored = evaluation(original, context, {
      bundleSha256: "old-bundle",
      sdkVersion: "0.0.0",
      runtimeContractsJson: "{}",
    });
    const newer = evaluation(original, context, { id: "newer", createdAt: new Date("2026-07-14T02:00:00Z") });
    const failed = evaluation(original, context, {
      id: "failed",
      status: "FAILED",
      issueCodesJson: '["SAFE_FAILURE"]',
      createdAt: new Date("2026-07-14T03:00:00Z"),
    });
    const lifecycle = deriveEvaluationLifecycle({
      evaluation: stored,
      product: null,
      binding,
      context,
      newerSuccess: newer,
      latestFailure: failed,
    });
    expect(lifecycle.state).toBe("superseded");
    expect(lifecycle.staleReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["PRODUCT_DELETED", "BUNDLE_CHANGED", "SDK_CHANGED", "RUNTIME_CONTRACT_CHANGED"]),
    );
    expect(lifecycle.latestRefreshFailure?.issueCodes).toEqual(["SAFE_FAILURE"]);
  });

  it("distinguishes ProductDNA and RuleSet artifact changes", () => {
    const original = product();
    const context = buildEvaluationContextIdentity(original, binding);
    const lifecycle = deriveEvaluationLifecycle({
      evaluation: evaluation(original, context, {
        productDnaFingerprint: "old-product-dna",
        ruleSetFingerprint: "old-ruleset",
      }),
      product: original,
      binding,
      context,
    });
    expect(lifecycle.staleReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["PRODUCT_DNA_CHANGED", "RULESET_CHANGED"]),
    );
  });
});

function product(): AuroraCatalogProduct {
  return {
    id: "product.db.one",
    slug: binding.expectedSlug,
    name: "Product",
    categoryId: "category.one",
    description: "Present",
    story: "Present",
    imageUrl: "/image.jpg",
    inventory: 2,
    adminStatus: "PUBLISHED",
    isActive: true,
    archivedAt: null,
    handmadeDaysMin: 5,
    handmadeDaysMax: 8,
    customizationFields: '[{"name":"notes","label":"Notes","type":"textarea"}]',
    updatedAt: new Date("2026-07-13T00:00:00Z"),
  };
}

function evaluation(
  value: AuroraCatalogProduct,
  context: ReturnType<typeof buildEvaluationContextIdentity>,
  changes: Partial<AuroraEvaluation> = {},
): AuroraEvaluation {
  return {
    id: "evaluation.one",
    requestKey: "00000000-0000-4000-8000-000000000000",
    requestIdentityJson: "{}",
    requestIdentityFingerprint: "request",
    operationType: "PRODUCT_EVALUATION",
    requestMode: "REEVALUATE",
    trigger: "test",
    requestedById: null,
    requestedByIdAtExecution: "admin.one",
    batchRequestKey: null,
    batchIdentityFingerprint: null,
    batchItemIndex: null,
    batchSize: null,
    productId: value.id,
    productIdAtExecution: value.id,
    productSlug: value.slug,
    productName: value.name,
    bindingId: binding.bindingId,
    bindingFingerprint: binding.entryFingerprint,
    bindingManifestFingerprint: context.bindingManifestFingerprint,
    projectId: binding.projectId,
    bundleFingerprint: auroraDeploymentIdentity.bundleFingerprint,
    bundleSha256: auroraDeploymentIdentity.bundleSha256,
    sdkVersion: auroraDeploymentIdentity.sdkVersion,
    runtimeContractsJson: context.runtimeContractsJson,
    productDnaArtifactId: binding.productDnaArtifactId,
    productDnaProductId: binding.productDnaProductId,
    productDnaFingerprint: currentAuroraArtifactFingerprint(binding.productDnaArtifactId)!,
    ruleSetArtifactId: binding.ruleSetArtifactId,
    ruleSetDomainId: binding.ruleSetDomainId,
    ruleSetFingerprint: currentAuroraArtifactFingerprint(binding.ruleSetArtifactId)!,
    applicationContextFingerprint: context.applicationContextFingerprint,
    auroraInputFingerprint: "input",
    auroraOutputFingerprint: "output",
    inputSnapshotJson: context.inputSnapshotJson,
    resultJson: "{}",
    resultSha256: "result",
    resultBytes: 2,
    status: "SUCCEEDED",
    failureStage: null,
    issueCodesJson: "[]",
    durationMs: 1,
    createdAt: new Date("2026-07-14T01:00:00Z"),
    ...changes,
  };
}
