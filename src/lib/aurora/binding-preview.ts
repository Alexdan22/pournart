import { AuroraRuntime } from "@aurora/sdk";
import { sha256, stableJson } from "./canonical-json";
import {
  auroraProductBindings,
  validateBindingManifest,
  type AuroraProductBinding,
} from "./bindings";

export type BindingPairPreview = Readonly<{
  compatible: boolean;
  issueCodes: readonly string[];
  additions: readonly string[];
  removals: readonly string[];
  changedBindings: readonly string[];
  manifestFingerprint?: string;
  bundleSha256: string;
  bundleFingerprint?: string;
  resultingActiveBindings: number;
  resultingAwaitingReview: number;
}>;

export function previewBindingPair(manifestValue: unknown, bundleText: string): BindingPairPreview {
  const bundleSha256 = sha256(bundleText);
  let bundleValue: unknown;
  try {
    bundleValue = JSON.parse(bundleText);
  } catch {
    return failedPreview(bundleSha256, ["CANDIDATE_BUNDLE_JSON_INVALID"]);
  }
  const manifest = record(manifestValue);
  const entries = array(manifest.entries).map(record);
  const first = entries[0];
  const loaded = AuroraRuntime.loadProject(bundleText);
  if (!loaded.ok)
    return failedPreview(
      bundleSha256,
      loaded.issues.map((issue) => issue.code),
    );
  if (!first)
    return failedPreview(bundleSha256, ["BINDING_MANIFEST_EMPTY"]);
  const probe = loaded.runtime.execute({
    ruleSet: { kind: "ruleset", artifactId: String(first.ruleSetArtifactId ?? "") },
    product: { kind: "product-dna", artifactId: String(first.productDnaArtifactId ?? "") },
  });
  const bundleFingerprint = probe.trace.projectFingerprint.value;
  const validated = validateBindingManifest(manifestValue, bundleValue, {
    bundle: { sha256: bundleSha256, projectFingerprint: bundleFingerprint },
  }, bundleSha256);
  const current = new Map(auroraProductBindings.map((entry) => [entry.bindingId, entry]));
  const candidate = new Map(validated.bindings.map((entry) => [entry.bindingId, entry]));
  const additions = [...candidate.keys()].filter((id) => !current.has(id)).sort();
  const removals = [...current.keys()].filter((id) => !candidate.has(id)).sort();
  const changedBindings = [...candidate.entries()]
    .filter(([id, entry]) => {
      const previous = current.get(id);
      return previous && comparableFingerprint(previous) !== comparableFingerprint(entry);
    })
    .map(([id]) => id)
    .sort();
  return Object.freeze({
    compatible: validated.health.ok,
    issueCodes: validated.health.issueCodes,
    additions: Object.freeze(additions),
    removals: Object.freeze(removals),
    changedBindings: Object.freeze(changedBindings),
    manifestFingerprint: validated.health.manifestFingerprint,
    bundleSha256,
    bundleFingerprint,
    resultingActiveBindings: validated.bindings.filter((entry) => entry.state === "active").length,
    resultingAwaitingReview: validated.bindings.filter((entry) => entry.state === "awaiting-review").length,
  });
}

function failedPreview(bundleSha256: string, issueCodes: readonly string[]): BindingPairPreview {
  return Object.freeze({
    compatible: false,
    issueCodes: Object.freeze([...issueCodes]),
    additions: Object.freeze([]),
    removals: Object.freeze([]),
    changedBindings: Object.freeze([]),
    bundleSha256,
    resultingActiveBindings: 0,
    resultingAwaitingReview: 0,
  });
}

function comparableFingerprint(binding: AuroraProductBinding) {
  const entry: Record<string, unknown> = { ...binding };
  delete entry.entryFingerprint;
  return sha256(stableJson(entry));
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
