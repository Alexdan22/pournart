import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import deployment from "../../../vendor/aurora/deployment-manifest.json";
import { initializeAurora, sha256 } from "./initializer";

const artifactDirectory = join(process.cwd(), "vendor", "aurora");

function loadRuntime() {
  try {
    const bundleText = readFileSync(join(artifactDirectory, deployment.bundle.filename), "utf8");
    const sdkBytes = readFileSync(join(artifactDirectory, deployment.sdk.tarball));
    return initializeAurora({
      bundleText,
      actualBundleSha256: sha256(bundleText),
      expectedBundleSha256: deployment.bundle.sha256,
      actualSdkSha256: sha256(sdkBytes),
      expectedSdkSha256: deployment.sdk.sha256,
      expectedProjectId: deployment.bundle.projectId,
      expectedProjectFingerprint: deployment.bundle.projectFingerprint,
      sdkVersion: deployment.sdk.version,
      sdkSourceCommit: deployment.sdk.sourceCommit,
      log: (event) => console.info(JSON.stringify(event)),
    });
  } catch {
    return {
      ok: false as const,
      health: {
        ok: false,
        sdkVersion: deployment.sdk.version,
        sdkSourceCommit: deployment.sdk.sourceCommit,
        sdkSha256: deployment.sdk.sha256,
        bundleSha256: deployment.bundle.sha256,
        projectId: deployment.bundle.projectId,
        issueCodes: ["ARTIFACT_READ_FAILURE"],
      },
    };
  }
}

export const auroraInitialization = loadRuntime();
export const auroraDeployment = deployment;
