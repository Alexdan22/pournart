import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuroraEvaluation } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { previewBindingPair } from "./binding-preview";
import {
  auroraBindingManifestHealth,
  auroraProductBindings,
  validateAuroraBinding,
  validateBindingManifest,
} from "./bindings";
import { buildAuroraCoverage } from "./coverage";
import { buildEvaluationContextIdentity } from "./identity";
import type { AuroraCatalogProduct } from "./types";

const vendor = join(process.cwd(), "vendor", "aurora");
const manifestValue = JSON.parse(readFileSync(join(vendor, "binding-manifest.json"), "utf8")) as {
  entries: Array<Record<string, unknown>>;
  expectedBundle: Record<string, unknown>;
};
const bundleText = readFileSync(join(vendor, "aurora-project.json"), "utf8");
const bundleValue = JSON.parse(bundleText) as unknown;
const deploymentValue = JSON.parse(readFileSync(join(vendor, "deployment-manifest.json"), "utf8")) as unknown;

describe("versioned Aurora binding manifest", () => {
  it("loads the repository pair with separate entry and manifest fingerprints", () => {
    expect(auroraBindingManifestHealth).toMatchObject({ ok: true, entryCount: 8 });
    expect(auroraBindingManifestHealth.manifestFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(auroraProductBindings.map((entry) => entry.entryFingerprint)).size).toBe(8);
  });

  it("rejects duplicate identities, missing artifacts, and incompatible checksums", () => {
    const duplicate = structuredClone(manifestValue);
    duplicate.entries[1]!.bindingId = duplicate.entries[0]!.bindingId;
    expect(validateBindingManifest(duplicate, bundleValue, deploymentValue).health.issueCodes).toContain(
      "BINDING_DUPLICATE_BINDING_ID",
    );

    const missing = structuredClone(manifestValue);
    missing.entries[0]!.productDnaArtifactId = "artifact.missing";
    expect(validateBindingManifest(missing, bundleValue, deploymentValue).health.issueCodes).toContain(
      "BINDING_PRODUCT_DNA_MISSING",
    );

    const incompatible = structuredClone(manifestValue);
    incompatible.expectedBundle.sha256 = "0".repeat(64);
    expect(validateBindingManifest(incompatible, bundleValue, deploymentValue).health.issueCodes).toContain(
      "BINDING_BUNDLE_CHECKSUM_MISMATCH",
    );
  });

  it("blocks awaiting-review bindings and environment-specific expected-ID mismatches", () => {
    const base = auroraProductBindings[0]!;
    expect(
      validateAuroraBinding(
        { ...base, state: "awaiting-review" },
        { id: "db.expected", slug: base.expectedSlug },
        "test",
      ),
    ).toMatchObject({ ok: false, state: "awaiting-review" });
    expect(
      validateAuroraBinding(
        { ...base, expectedDatabaseIds: { test: "db.expected" } },
        { id: "db.other", slug: base.expectedSlug },
        "test",
      ),
    ).toMatchObject({ ok: false, state: "stale-binding" });
  });

  it("previews the repository pair without activating or editing it", () => {
    const preview = previewBindingPair(manifestValue, bundleText);
    expect(preview).toMatchObject({
      compatible: true,
      additions: [],
      removals: [],
      changedBindings: [],
      resultingActiveBindings: 8,
    });
  });
});

describe("catalog coverage", () => {
  it("reports active/not-evaluated coverage and exact readiness blockers", () => {
    const ready = sampleProduct();
    const blocked = {
      ...sampleProduct(),
      id: "product.blocked",
      slug: "not-bound",
      adminStatus: "DRAFT",
      inventory: 0,
    };
    const coverage = buildAuroraCoverage([ready, blocked], []);
    expect(coverage.totals).toMatchObject({
      products: 2,
      ready: 1,
      binding: { active: 1, unbound: 1 },
      evaluation: { "not-evaluated": 2 },
    });
    expect(coverage.items[1]!.readinessReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["BINDING_NOT_FOUND", "PRODUCT_NOT_PUBLISHED", "INVENTORY_UNAVAILABLE"]),
    );
  });

  it("distinguishes current, stale, failed, and latest refresh failure", () => {
    const product = sampleProduct();
    const binding = auroraProductBindings.find((entry) => entry.expectedSlug === product.slug)!;
    const currentContext = buildEvaluationContextIdentity(product, binding).applicationContextFingerprint;
    const success = evaluation("success", "SUCCEEDED", currentContext, new Date("2026-07-13T10:00:00Z"));
    const failure = evaluation("failure", "FAILED", currentContext, new Date("2026-07-13T11:00:00Z"));
    expect(buildAuroraCoverage([product], [success, failure]).items[0]!.evaluation).toBe(
      "current-with-latest-refresh-failure",
    );
    expect(
      buildAuroraCoverage([product], [
        evaluation("stale", "SUCCEEDED", "old-context", new Date("2026-07-13T09:00:00Z")),
      ]).items[0]!.evaluation,
    ).toBe("stale");
    expect(buildAuroraCoverage([product], [failure]).items[0]!.evaluation).toBe("failed");
  });

  it("reports the durable evaluation-level review state", () => {
    const product = sampleProduct();
    const binding = auroraProductBindings.find((entry) => entry.expectedSlug === product.slug)!;
    const context = buildEvaluationContextIdentity(product, binding).applicationContextFingerprint;
    const success = evaluation("reviewed", "SUCCEEDED", context, new Date("2026-07-13T10:00:00Z"));
    const coverage = buildAuroraCoverage([product], [success], [
      { evaluationId: success.id, targetKey: "evaluation", state: "NEEDS_CHANGES" },
    ]);
    expect(coverage.items[0]!.review).toBe("needs-changes");
    expect(coverage.totals.review["needs-changes"]).toBe(1);
  });
});

function sampleProduct(): AuroraCatalogProduct {
  return {
    id: "product.one",
    slug: "ocean-bloom-coaster-set",
    name: "Structured fixture",
    categoryId: "category.one",
    description: "Present",
    story: "Present",
    imageUrl: "/fixture.png",
    inventory: 3,
    adminStatus: "PUBLISHED",
    isActive: true,
    archivedAt: null,
    handmadeDaysMin: 4,
    handmadeDaysMax: 7,
    customizationFields: "[]",
    updatedAt: new Date("2026-07-13T00:00:00Z"),
  };
}

function evaluation(
  id: string,
  status: string,
  applicationContextFingerprint: string,
  createdAt: Date,
): AuroraEvaluation {
  return {
    id,
    requestKey: `00000000-0000-4000-8000-${id.padEnd(12, "0").slice(0, 12)}`,
    requestIdentityJson: "{}",
    requestIdentityFingerprint: "identity",
    operationType: "PRODUCT_EVALUATION",
    requestMode: "REEVALUATE",
    trigger: "test",
    requestedById: null,
    requestedByIdAtExecution: "admin",
    batchRequestKey: null,
    batchIdentityFingerprint: null,
    batchItemIndex: null,
    batchSize: null,
    productId: "product.one",
    productIdAtExecution: "product.one",
    productSlug: "ocean-bloom-coaster-set",
    productName: "Structured fixture",
    bindingId: "binding.pna.ocean-bloom-coaster-set",
    bindingFingerprint: "binding",
    bindingManifestFingerprint: "manifest",
    projectId: "project.pna.catalog-intelligence-pilot",
    bundleFingerprint: "bundle",
    bundleSha256: "bundle-sha",
    sdkVersion: "1.0.0-pilot.1",
    runtimeContractsJson: "{}",
    productDnaArtifactId: "artifact.pna.product.ocean-bloom-coaster-set",
    productDnaProductId: "product.pna.ocean-bloom-coaster-set",
    productDnaFingerprint: "product-dna",
    ruleSetArtifactId: "artifact.pna.ruleset.catalog-readiness",
    ruleSetDomainId: "ruleset.pna.catalog-readiness",
    ruleSetFingerprint: "ruleset",
    applicationContextFingerprint,
    auroraInputFingerprint: null,
    auroraOutputFingerprint: null,
    inputSnapshotJson: "{}",
    resultJson: status === "SUCCEEDED" ? "{}" : null,
    resultSha256: status === "SUCCEEDED" ? "result" : null,
    resultBytes: status === "SUCCEEDED" ? 2 : null,
    status,
    failureStage: status === "FAILED" ? "reasoning" : null,
    issueCodesJson: status === "FAILED" ? "[\"SAFE_FAILURE\"]" : "[]",
    durationMs: 1,
    createdAt,
  };
}
