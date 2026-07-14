import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sha256, stableJson } from "./canonical-json";

export type ApprovedExplicitFact =
  | "pilot.premium-presentation.approved"
  | "pilot.care-guidance.required"
  | "pilot.admin-review.required";

export type AuroraBindingState = "active" | "awaiting-review";

export type AuroraProductBinding = Readonly<{
  state: AuroraBindingState;
  bindingId: string;
  expectedSlug: string;
  expectedDatabaseIds: Readonly<Record<string, string>>;
  projectId: "project.pna.catalog-intelligence-pilot";
  productDnaArtifactId: string;
  productDnaProductId: string;
  ruleSetArtifactId: "artifact.pna.ruleset.catalog-readiness";
  ruleSetDomainId: "ruleset.pna.catalog-readiness";
  approvedExplicitFacts: readonly ApprovedExplicitFact[];
  entryFingerprint: string;
}>;

const explicitFactSchema = z.enum([
  "pilot.premium-presentation.approved",
  "pilot.care-guidance.required",
  "pilot.admin-review.required",
]);

const entrySchema = z
  .object({
    state: z.enum(["active", "awaiting-review"]),
    bindingId: z.string().min(1).max(160),
    expectedSlug: z.string().min(1).max(160),
    expectedDatabaseIds: z
      .record(z.string().min(1).max(80), z.string().min(1).max(160))
      .default({}),
    projectId: z.literal("project.pna.catalog-intelligence-pilot"),
    productDnaArtifactId: z.string().min(1).max(200),
    productDnaProductId: z.string().min(1).max(200),
    ruleSetArtifactId: z.literal("artifact.pna.ruleset.catalog-readiness"),
    ruleSetDomainId: z.literal("ruleset.pna.catalog-readiness"),
    approvedExplicitFacts: z.array(explicitFactSchema).max(3),
  })
  .strict();

const manifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    manifestId: z.string().min(1).max(160),
    projectId: z.literal("project.pna.catalog-intelligence-pilot"),
    expectedBundle: z
      .object({
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        projectFingerprint: z.string().regex(/^[0-9a-f]{64}$/),
      })
      .strict(),
    entries: z.array(entrySchema).max(100),
  })
  .strict();

type ParsedManifest = z.infer<typeof manifestSchema>;

export type BindingManifestHealth = Readonly<{
  ok: boolean;
  manifestId?: string;
  manifestFingerprint?: string;
  issueCodes: readonly string[];
  bundleSha256: string;
  bundleFingerprint: string;
  entryCount: number;
  productDnaCount: number;
  ruleSetCount: number;
}>;

const artifactDirectory = join(process.cwd(), "vendor", "aurora");
const loaded = loadRepositoryBindingManifest();

export const auroraBindingManifestHealth = loaded.health;
export const auroraBindingManifestFingerprint = loaded.health.manifestFingerprint ?? "invalid";
export const auroraProductBindings = loaded.bindings;
export function currentAuroraArtifactFingerprint(artifactId: string) {
  return loaded.artifactFingerprints.get(artifactId);
}

const bindingBySlug = new Map(auroraProductBindings.map((item) => [item.expectedSlug, item]));

export type BindingResolution =
  | { readonly ok: true; readonly binding: AuroraProductBinding }
  | {
      readonly ok: false;
      readonly state:
        | "no-binding"
        | "awaiting-review"
        | "stale-binding"
        | "invalid-binding"
        | "missing-product-dna"
        | "missing-ruleset";
      readonly message: string;
      readonly binding?: AuroraProductBinding;
    };

export function resolveAuroraBinding(product: { id: string; slug: string }): BindingResolution {
  if (!auroraBindingManifestHealth.ok)
    return {
      ok: false,
      state: auroraBindingManifestHealth.issueCodes.includes("BINDING_PRODUCT_DNA_MISSING")
        ? "missing-product-dna"
        : auroraBindingManifestHealth.issueCodes.includes("BINDING_RULESET_MISSING")
          ? "missing-ruleset"
          : "invalid-binding",
      message: "The repository binding manifest is incompatible with the active Aurora bundle.",
    };
  const candidate = bindingBySlug.get(product.slug);
  if (!candidate)
    return {
      ok: false,
      state: "no-binding",
      message: "No Aurora binding exists for this exact product slug.",
    };
  return validateAuroraBinding(candidate, product);
}

export function validateAuroraBinding(
  candidate: AuroraProductBinding,
  product: { id: string; slug: string },
  environment = deploymentEnvironment(),
): BindingResolution {
  if (candidate.expectedSlug !== product.slug)
    return {
      ok: false,
      state: "no-binding",
      message: "The exact configured product slug does not match this record.",
      binding: candidate,
    };
  if (candidate.state === "awaiting-review")
    return {
      ok: false,
      state: "awaiting-review",
      message: "This exact binding is awaiting human review and cannot execute.",
      binding: candidate,
    };
  const expectedId = candidate.expectedDatabaseIds[environment];
  if (expectedId && expectedId !== product.id)
    return {
      ok: false,
      state: "stale-binding",
      message: "The configured environment-specific product ID does not match this record.",
      binding: candidate,
    };
  return { ok: true, binding: candidate };
}

export function validateBindingManifest(
  manifestValue: unknown,
  bundleValue: unknown,
  deploymentValue: unknown,
  actualBundleSha256?: string,
): {
  readonly health: BindingManifestHealth;
  readonly bindings: readonly AuroraProductBinding[];
  readonly artifactFingerprints: ReadonlyMap<string, string>;
} {
  const manifestResult = manifestSchema.safeParse(manifestValue);
  const bundle = record(bundleValue);
  const deployment = record(deploymentValue);
  const deploymentBundle = record(deployment.bundle);
  const artifacts = array(bundle.artifacts).map(record);
  const productArtifacts = new Map<string, string>();
  const ruleSetArtifacts = new Map<string, string>();
  const artifactFingerprints = new Map<string, string>();
  for (const artifact of artifacts) {
    const reference = record(artifact.reference);
    const content = record(artifact.content);
    const artifactId = typeof reference.artifactId === "string" ? reference.artifactId : "";
    if (artifactId) artifactFingerprints.set(artifactId, sha256(stableJson(artifact.content)));
    if (reference.kind === "product-dna") {
      const productId = record(content.identity).productId;
      productArtifacts.set(artifactId, typeof productId === "string" ? productId : "");
    }
    if (reference.kind === "ruleset") {
      const domainId = record(content.id).value;
      ruleSetArtifacts.set(artifactId, typeof domainId === "string" ? domainId : "");
    }
  }

  const declaredBundleSha256 =
    typeof deploymentBundle.sha256 === "string" ? deploymentBundle.sha256 : "";
  const bundleSha256 = actualBundleSha256 ?? declaredBundleSha256;
  const bundleFingerprint =
    typeof deploymentBundle.projectFingerprint === "string"
      ? deploymentBundle.projectFingerprint
      : "";
  if (!manifestResult.success)
    return {
      health: Object.freeze({
        ok: false,
        issueCodes: Object.freeze(["BINDING_MANIFEST_SCHEMA_INVALID"]),
        bundleSha256,
        bundleFingerprint,
        entryCount: 0,
        productDnaCount: productArtifacts.size,
        ruleSetCount: ruleSetArtifacts.size,
      }),
      bindings: Object.freeze([]),
      artifactFingerprints,
    };

  const manifest = manifestResult.data;
  const issueCodes = validateManifestIdentities(
    manifest,
    productArtifacts,
    ruleSetArtifacts,
    bundle,
    bundleSha256,
    bundleFingerprint,
    declaredBundleSha256,
  );
  const manifestFingerprint = sha256(stableJson(manifest));
  const bindings = manifest.entries.map((entry) =>
    Object.freeze({
      ...entry,
      expectedDatabaseIds: Object.freeze({ ...entry.expectedDatabaseIds }),
      approvedExplicitFacts: Object.freeze([...entry.approvedExplicitFacts]),
      entryFingerprint: sha256(stableJson(entry)),
    }),
  );
  return {
    health: Object.freeze({
      ok: issueCodes.length === 0,
      manifestId: manifest.manifestId,
      manifestFingerprint,
      issueCodes: Object.freeze(issueCodes),
      bundleSha256,
      bundleFingerprint,
      entryCount: bindings.length,
      productDnaCount: productArtifacts.size,
      ruleSetCount: ruleSetArtifacts.size,
    }),
    bindings: Object.freeze(bindings),
    artifactFingerprints,
  };
}

function loadRepositoryBindingManifest(): ReturnType<typeof validateBindingManifest> {
  try {
    const manifestValue = JSON.parse(
      readFileSync(join(artifactDirectory, "binding-manifest.json"), "utf8"),
    ) as unknown;
    const bundleText = readFileSync(join(artifactDirectory, "aurora-project.json"), "utf8");
    const bundleValue = JSON.parse(bundleText) as unknown;
    const deploymentValue = JSON.parse(
      readFileSync(join(artifactDirectory, "deployment-manifest.json"), "utf8"),
    ) as unknown;
    return validateBindingManifest(manifestValue, bundleValue, deploymentValue, sha256(bundleText));
  } catch {
    return {
      health: Object.freeze({
        ok: false,
        issueCodes: Object.freeze(["BINDING_ARTIFACT_READ_FAILURE"]),
        bundleSha256: "",
        bundleFingerprint: "",
        entryCount: 0,
        productDnaCount: 0,
        ruleSetCount: 0,
      }) satisfies BindingManifestHealth,
      bindings: Object.freeze([]) as readonly AuroraProductBinding[],
      artifactFingerprints: new Map<string, string>(),
    };
  }
}

function validateManifestIdentities(
  manifest: ParsedManifest,
  productArtifacts: ReadonlyMap<string, string>,
  ruleSetArtifacts: ReadonlyMap<string, string>,
  bundle: Record<string, unknown>,
  bundleSha256: string,
  bundleFingerprint: string,
  declaredBundleSha256: string,
) {
  const issues = new Set<string>();
  if (manifest.expectedBundle.sha256 !== bundleSha256) issues.add("BINDING_BUNDLE_CHECKSUM_MISMATCH");
  if (declaredBundleSha256 !== bundleSha256) issues.add("DEPLOYMENT_BUNDLE_CHECKSUM_MISMATCH");
  if (manifest.expectedBundle.projectFingerprint !== bundleFingerprint)
    issues.add("BINDING_BUNDLE_FINGERPRINT_MISMATCH");
  if (record(bundle.project).id !== manifest.projectId) issues.add("BINDING_PROJECT_ID_MISMATCH");
  for (const field of [
    "bindingId",
    "expectedSlug",
    "productDnaArtifactId",
    "productDnaProductId",
  ] as const) {
    if (hasDuplicate(manifest.entries.map((entry) => entry[field])))
      issues.add(`BINDING_DUPLICATE_${field.replace(/([A-Z])/g, "_$1").toUpperCase()}`);
  }
  for (const entry of manifest.entries) {
    if (productArtifacts.get(entry.productDnaArtifactId) !== entry.productDnaProductId)
      issues.add("BINDING_PRODUCT_DNA_MISSING");
    if (ruleSetArtifacts.get(entry.ruleSetArtifactId) !== entry.ruleSetDomainId)
      issues.add("BINDING_RULESET_MISSING");
  }
  return [...issues].sort();
}

function deploymentEnvironment() {
  const value = process.env.AURORA_PILOT_ENVIRONMENT?.trim();
  return value && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(value) ? value : "local";
}

function hasDuplicate(values: readonly string[]) {
  return new Set(values).size !== values.length;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
