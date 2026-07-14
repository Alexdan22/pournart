import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildAuroraExplicitReferences } from "./assertions";
import { evaluateAuroraAccess, parseAuroraAllowlist } from "./access";
import { auroraProductBindings, resolveAuroraBinding, validateAuroraBinding } from "./bindings";
import { BoundedFifoCache } from "./cache";
import { loadAndEvaluateProduct } from "./evaluation";
import { initializeAurora, sha256 } from "./initializer";
import type { AuroraCatalogProduct } from "./types";

const vendor = join(process.cwd(), "vendor", "aurora");
const bundleText = readFileSync(join(vendor, "aurora-project.json"), "utf8");
const manifest = JSON.parse(readFileSync(join(vendor, "deployment-manifest.json"), "utf8"));

describe("Aurora product bindings", () => {
  it("resolves only the exact current slug and keeps identities separate", () => {
    const result = resolveAuroraBinding({ id: "db.local", slug: "memory-resin-frame" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.binding.bindingId).not.toBe("db.local");
    expect(result.binding.productDnaArtifactId).not.toBe(result.binding.productDnaProductId);
    expect(resolveAuroraBinding({ id: "db.local", slug: "memory-resin-frame-renamed" })).toMatchObject({
      ok: false,
      state: "no-binding",
    });
  });

  it("blocks an optional environment-specific expected ID mismatch", () => {
    const configured = { ...auroraProductBindings[0]!, expectedProductId: "db.expected" };
    expect(validateAuroraBinding(configured, { id: "db.other", slug: configured.expectedSlug })).toMatchObject({
      ok: false,
      state: "stale-binding",
    });
  });

  it("constructs deterministic assertions with database identity in provenance", () => {
    const product = sampleProduct();
    const binding = auroraProductBindings.find((item) => item.expectedSlug === product.slug)!;
    const references = buildAuroraExplicitReferences(product, binding);
    expect(references.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "catalog.product.published",
        "catalog.product.active",
        "catalog.inventory.available",
        "catalog.lead-time.valid",
        "catalog.information.complete",
        "pilot.care-guidance.required",
      ]),
    );
    expect(references.filter((item) => item.sourceKind === "pour-n-art-product").every((item) => item.sourceId === product.id)).toBe(true);
    expect(JSON.parse(JSON.stringify(references))).toEqual(references);
  });

  it("returns a structured missing-product state without evaluating", async () => {
    const evaluate = vi.fn();
    await expect(loadAndEvaluateProduct("missing", async () => null, evaluate)).resolves.toMatchObject({
      state: "missing-product",
      productId: "missing",
    });
    expect(evaluate).not.toHaveBeenCalled();
  });
});

describe("Aurora runtime initialization and cache", () => {
  it("verifies SDK and bundle checksums and initializes the expected project", () => {
    const initialized = validInitialization();
    expect(initialized.ok).toBe(true);
    expect(initialized.health).toMatchObject({
      ok: true,
      projectId: manifest.bundle.projectId,
      projectFingerprint: manifest.bundle.projectFingerprint,
    });
  });

  it("isolates an invalid bundle and checksum failure", () => {
    const invalid = initializeAurora({
      ...initializationInput(),
      bundleText: "{invalid",
      actualBundleSha256: sha256("{invalid"),
      expectedBundleSha256: sha256("{invalid"),
    });
    expect(invalid).toMatchObject({ ok: false, health: { ok: false } });
    const checksum = initializeAurora({ ...initializationInput(), actualSdkSha256: "wrong" });
    expect(checksum).toMatchObject({ ok: false, health: { issueCodes: ["SDK_CHECKSUM_MISMATCH"] } });
  });

  it("returns a structured missing-artifact failure and JSON-safe success", () => {
    const initialized = validInitialization();
    if (!initialized.ok) throw new Error("Expected valid initialization.");
    const missing = initialized.service.execute({
      ruleSet: { kind: "ruleset", artifactId: "missing" },
    });
    expect(missing).toMatchObject({ ok: false, stage: "request" });
    const success = initialized.service.execute({
      ruleSet: { kind: "ruleset", artifactId: "artifact.pna.ruleset.catalog-readiness" },
      product: { kind: "product-dna", artifactId: "artifact.pna.product.ocean-bloom-coaster-set" },
    });
    expect(success.ok).toBe(true);
    expect(() => JSON.stringify(success)).not.toThrow();
  });

  it("bounds FIFO entries and partitions service results by deterministic fingerprints", () => {
    const cache = new BoundedFifoCache(2);
    const response = { ok: false as const, stage: "request" as const, issues: [], trace: {} };
    cache.set("bundle-a:one", response);
    cache.set("bundle-a:two", response);
    cache.set("bundle-b:one", response);
    expect(cache.size).toBe(2);
    expect(cache.get("bundle-a:one")).toBeUndefined();
    expect(cache.get("bundle-b:one")).toBe(response);

  });

  it("logs only operational identifiers, issue codes, fingerprints, and duration", () => {
    const events: Record<string, unknown>[] = [];
    const initialized = initializeAurora({ ...initializationInput(), log: (event) => events.push(event) });
    if (!initialized.ok) throw new Error("Expected valid initialization.");
    initialized.service.execute({
      ruleSet: { kind: "ruleset", artifactId: "artifact.pna.ruleset.catalog-readiness" },
      product: { kind: "product-dna", artifactId: "artifact.pna.product.ocean-bloom-coaster-set" },
    });
    expect(events).toHaveLength(1);
    const serialized = JSON.stringify(events[0]);
    expect(serialized).not.toContain("Ocean-Inspired Gift Coaster Set");
    expect(serialized).not.toContain("provenance");
    expect(events[0]).toEqual(
      expect.objectContaining({ event: "aurora.intelligence", stage: "success", durationMs: expect.any(Number) }),
    );
  });
});

describe("Aurora pilot authorization", () => {
  const admin = { id: "admin-1", email: "owner@example.com", role: "ADMIN" };

  it("requires enabled feature, authenticated admin, and allowlist membership", () => {
    const allowlist = parseAuroraAllowlist("OWNER@EXAMPLE.COM, admin-2");
    expect(evaluateAuroraAccess({ enabled: false, allowlist, session: admin })).toMatchObject({ code: "DISABLED" });
    expect(evaluateAuroraAccess({ enabled: true, allowlist, session: null })).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(evaluateAuroraAccess({ enabled: true, allowlist, session: { ...admin, role: "CUSTOMER" } })).toMatchObject({ code: "NOT_ADMIN" });
    expect(evaluateAuroraAccess({ enabled: true, allowlist: new Set(), session: admin })).toMatchObject({ code: "NOT_ALLOWLISTED" });
    expect(evaluateAuroraAccess({ enabled: true, allowlist, session: admin })).toEqual({ ok: true });
  });
});

describe("Aurora customer boundary", () => {
  it("does not expose a customer Aurora API or storefront route", () => {
    expect(existsSync(join(process.cwd(), "src", "app", "api", "aurora"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src", "app", "(store)", "aurora"))).toBe(false);
  });
});

function initializationInput() {
  const sdkBytes = readFileSync(join(vendor, manifest.sdk.tarball));
  return {
    bundleText,
    actualBundleSha256: sha256(bundleText),
    expectedBundleSha256: manifest.bundle.sha256,
    actualSdkSha256: sha256(sdkBytes),
    expectedSdkSha256: manifest.sdk.sha256,
    expectedProjectId: manifest.bundle.projectId,
    expectedProjectFingerprint: manifest.bundle.projectFingerprint,
    sdkVersion: manifest.sdk.version,
    sdkSourceCommit: manifest.sdk.sourceCommit,
  };
}

function validInitialization() {
  return initializeAurora(initializationInput());
}

function sampleProduct(): AuroraCatalogProduct {
  return {
    id: "db.local.coaster",
    slug: "ocean-bloom-coaster-set",
    name: "Coaster",
    categoryId: "category.ocean",
    description: "Present",
    story: "Present",
    imageUrl: "/image.png",
    inventory: 2,
    adminStatus: "PUBLISHED",
    isActive: true,
    archivedAt: null,
    handmadeDaysMin: 5,
    handmadeDaysMax: 8,
    customizationFields: JSON.stringify([{ name: "notes", label: "Notes", type: "textarea" }]),
    updatedAt: new Date("2026-07-13T00:00:00.000Z"),
  };
}
