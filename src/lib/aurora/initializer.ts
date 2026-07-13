import { createHash } from "node:crypto";
import { AuroraRuntime } from "@aurora/sdk";
import { AuroraApplicationService } from "@aurora/sdk/integration";
import { BoundedFifoCache } from "./cache";
import type { AuroraInitializationHealth } from "./types";

export type AuroraLogEvent = Readonly<Record<string, unknown>>;

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function initializeAurora(input: {
  bundleText: string;
  actualBundleSha256: string;
  expectedBundleSha256: string;
  actualSdkSha256: string;
  expectedSdkSha256: string;
  expectedProjectId: string;
  expectedProjectFingerprint: string;
  sdkVersion: string;
  sdkSourceCommit: string;
  log?: (event: AuroraLogEvent) => void;
}) {
  const base = {
    sdkVersion: input.sdkVersion,
    sdkSourceCommit: input.sdkSourceCommit,
    sdkSha256: input.actualSdkSha256,
    bundleSha256: input.actualBundleSha256,
    projectId: input.expectedProjectId,
  };
  const checksumIssues = [
    ...(input.actualBundleSha256 === input.expectedBundleSha256 ? [] : ["BUNDLE_CHECKSUM_MISMATCH"]),
    ...(input.actualSdkSha256 === input.expectedSdkSha256 ? [] : ["SDK_CHECKSUM_MISMATCH"]),
  ];
  if (checksumIssues.length)
    return { ok: false as const, health: healthFailure(base, checksumIssues) };

  const loaded = AuroraRuntime.loadProject(input.bundleText);
  if (!loaded.ok)
    return {
      ok: false as const,
      health: healthFailure(base, loaded.issues.map((issue) => issue.code)),
    };
  if (loaded.runtime.projectId !== input.expectedProjectId)
    return { ok: false as const, health: healthFailure(base, ["PROJECT_ID_MISMATCH"]) };

  const probe = loaded.runtime.execute({
    ruleSet: { kind: "ruleset", artifactId: "artifact.pna.ruleset.catalog-readiness" },
    product: { kind: "product-dna", artifactId: "artifact.pna.product.ocean-bloom-coaster-set" },
  });
  const fingerprint = probe.trace.projectFingerprint.value;
  if (fingerprint !== input.expectedProjectFingerprint)
    return { ok: false as const, health: healthFailure(base, ["PROJECT_FINGERPRINT_MISMATCH"], fingerprint) };

  const cache = new BoundedFifoCache(200);
  const service = new AuroraApplicationService(loaded.runtime, {
    cache,
    log(event) {
      input.log?.({ event: "aurora.intelligence", ...event });
    },
  });
  return {
    ok: true as const,
    runtime: loaded.runtime,
    service,
    cache,
    health: Object.freeze({ ...base, ok: true, projectFingerprint: fingerprint, issueCodes: Object.freeze([]) }) satisfies AuroraInitializationHealth,
  };
}

function healthFailure(
  base: Omit<AuroraInitializationHealth, "ok" | "issueCodes">,
  issueCodes: readonly string[],
  projectFingerprint?: string,
): AuroraInitializationHealth {
  return Object.freeze({ ...base, ok: false, ...(projectFingerprint ? { projectFingerprint } : {}), issueCodes: Object.freeze([...issueCodes]) });
}
