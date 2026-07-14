import type { BindingManifestHealth } from "./bindings";
import type { AuroraInitializationHealth } from "./types";

export function buildAuroraHealthContract(input: {
  initialization: Readonly<{ ok: boolean; health: AuroraInitializationHealth }>;
  compatibility: unknown;
  bindingManifestHealth: BindingManifestHealth;
}) {
  const bindingManifestReady =
    input.bindingManifestHealth.ok &&
    typeof input.bindingManifestHealth.manifestFingerprint === "string";
  const ok = input.initialization.ok && bindingManifestReady;
  const issueCodes = bindingManifestReady
    ? input.bindingManifestHealth.issueCodes
    : input.bindingManifestHealth.issueCodes.length > 0
      ? input.bindingManifestHealth.issueCodes
      : ["BINDING_MANIFEST_FINGERPRINT_MISSING"];

  return Object.freeze({
    status: ok ? 200 : 503,
    body: Object.freeze({
      ok,
      health: input.initialization.health,
      compatibility: input.compatibility,
      bindingManifest: Object.freeze({
        ok: bindingManifestReady,
        manifestId: input.bindingManifestHealth.manifestId,
        manifestFingerprint: input.bindingManifestHealth.manifestFingerprint,
        issueCodes: Object.freeze([...issueCodes]),
      }),
    }),
  });
}
