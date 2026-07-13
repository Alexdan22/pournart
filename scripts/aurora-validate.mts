import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuroraRuntime } from "@aurora/sdk";

const root = process.cwd();
const vendor = join(root, "vendor", "aurora");
const manifest = JSON.parse(readFileSync(join(vendor, "deployment-manifest.json"), "utf8"));
const bundleText = readFileSync(join(vendor, manifest.bundle.filename), "utf8");
const sdk = readFileSync(join(vendor, manifest.sdk.tarball));

assert(sha256(bundleText) === manifest.bundle.sha256, "Bundle checksum mismatch.");
assert(sha256(sdk) === manifest.sdk.sha256, "SDK checksum mismatch.");
assert(manifest.sdk.version === "1.0.0-pilot.1", "Unexpected SDK pilot version.");
assert(manifest.bundle.formatVersion === 1, "Unsupported project format.");

const loaded = AuroraRuntime.loadProject(bundleText);
assert(loaded.ok, "Aurora project bundle did not load.");
if (!loaded.ok) process.exit(1);
assert(loaded.runtime.projectId === manifest.bundle.projectId, "Project ID mismatch.");

const productArtifacts = (JSON.parse(bundleText).artifacts as { reference: { kind: string; artifactId: string } }[])
  .filter((artifact) => artifact.reference.kind === "product-dna")
  .map((artifact) => artifact.reference.artifactId);
assert(productArtifacts.length === 8, "Expected eight ProductDNA artifacts.");

for (const artifactId of productArtifacts) {
  const result = loaded.runtime.execute({
    ruleSet: { kind: "ruleset", artifactId: "artifact.pna.ruleset.catalog-readiness" },
    product: { kind: "product-dna", artifactId },
  });
  assert(result.ok, `Runtime execution failed for ${artifactId}.`);
  assert(result.trace.projectFingerprint.value === manifest.bundle.projectFingerprint, "Project fingerprint mismatch.");
}

console.info(
  JSON.stringify({
    ok: true,
    sdkVersion: manifest.sdk.version,
    sdkSourceCommit: manifest.sdk.sourceCommit,
    sdkSha256: manifest.sdk.sha256,
    projectId: manifest.bundle.projectId,
    projectFingerprint: manifest.bundle.projectFingerprint,
    bundleSha256: manifest.bundle.sha256,
    productArtifacts: productArtifacts.length,
  }),
);

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
