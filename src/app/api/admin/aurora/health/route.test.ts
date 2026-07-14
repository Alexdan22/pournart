import { beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({
  authorize: vi.fn(),
  initialization: {
    ok: true,
    health: {
      ok: true,
      sdkVersion: "1.0.0-pilot.1",
      sdkSourceCommit: "sdk-source",
      sdkSha256: "sdk-sha",
      bundleSha256: "bundle-sha",
      projectId: "project.pna.catalog-intelligence-pilot",
      projectFingerprint: "project-fingerprint",
      issueCodes: [] as string[],
    },
  },
  deployment: { compatibility: { projectFormat: 1, fingerprint: "aurora-json-v1" } },
  bindingHealth: {
    ok: true,
    manifestId: "manifest.pna.catalog-bindings",
    manifestFingerprint: "03d4abd6c14b3c8a14cc2265027e893d0de81c824be62b00b3d6dad675a45499",
    issueCodes: [] as string[],
    bundleSha256: "bundle-sha",
    bundleFingerprint: "project-fingerprint",
    entryCount: 12,
    productDnaCount: 12,
    ruleSetCount: 1,
  },
}));

vi.mock("@/lib/aurora/api-access", () => ({ authorizeAuroraApi: fixtures.authorize }));
vi.mock("@/lib/aurora/runtime", () => ({
  auroraInitialization: fixtures.initialization,
  auroraDeployment: fixtures.deployment,
}));
vi.mock("@/lib/aurora/bindings", () => ({
  auroraBindingManifestHealth: fixtures.bindingHealth,
}));

import { GET } from "./route";

describe("protected Aurora health route", () => {
  beforeEach(() => {
    fixtures.authorize.mockResolvedValue({ ok: true, session: { id: "admin" } });
    fixtures.bindingHealth.ok = true;
    fixtures.bindingHealth.issueCodes = [];
  });

  it("reports the loaded validated binding-manifest identity without leaking entries", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      health: fixtures.initialization.health,
      compatibility: fixtures.deployment.compatibility,
      bindingManifest: {
        ok: true,
        manifestId: fixtures.bindingHealth.manifestId,
        manifestFingerprint: fixtures.bindingHealth.manifestFingerprint,
        issueCodes: [],
      },
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("entries");
    expect(serialized).not.toContain("approvedExplicitFacts");
    expect(serialized).not.toContain("expectedSlug");
    expect(serialized).not.toContain("productDnaArtifactId");
  });

  it.each([
    [401, "UNAUTHENTICATED"],
    [403, "NOT_ADMIN"],
    [403, "NOT_ALLOWLISTED"],
    [404, "DISABLED"],
  ])("preserves the safe access response with status %i", async (status, code) => {
    fixtures.authorize.mockResolvedValue({
      ok: false,
      response: Response.json(
        { ok: false, error: "Aurora pilot access is unavailable.", code },
        { status },
      ),
    });

    const response = await GET();
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Aurora pilot access is unavailable.",
      code,
    });
  });

  it("fails health readiness when manifest/bundle compatibility is invalid", async () => {
    fixtures.bindingHealth.ok = false;
    fixtures.bindingHealth.issueCodes = ["BINDING_BUNDLE_CHECKSUM_MISMATCH"];

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      health: fixtures.initialization.health,
      bindingManifest: {
        ok: false,
        issueCodes: ["BINDING_BUNDLE_CHECKSUM_MISMATCH"],
      },
    });
  });
});
