import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuroraProductBinding } from "./bindings";
import { auroraProductBindings } from "./bindings";
import type { AuroraCatalogProduct } from "./types";

const deployment = JSON.parse(
  readFileSync(join(process.cwd(), "vendor", "aurora", "deployment-manifest.json"), "utf8"),
);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const BATCH_ITEM_NAMESPACE = "dd5cfe65-e29d-5aa7-9de4-61e8d39236b8";

export type AuroraRequestMode = "REUSE_CURRENT" | "REEVALUATE" | "RETRY";
export type AuroraOperationType = "PRODUCT_EVALUATION" | "CATALOG_BATCH_ITEM";

export type EvaluationContextIdentity = Readonly<{
  inputSnapshotJson: string;
  applicationContextFingerprint: string;
  bindingFingerprint: string;
  bindingManifestFingerprint: string;
  runtimeContractsJson: string;
}>;

export type EvaluationRequestIdentity = Readonly<{
  operationType: AuroraOperationType;
  requestMode: AuroraRequestMode;
  productId: string;
  productSlug: string;
  bindingId: string;
  bindingFingerprint: string;
  applicationContextFingerprint: string;
  requestedById: string;
  batchRequestKey?: string;
  batchIdentityFingerprint?: string;
  batchItemIndex?: number;
  batchSize?: number;
}>;

export function createRequestKey() {
  return randomUUID();
}

export function parseRequestKey(value: unknown): string | undefined {
  return typeof value === "string" && value.length === 36 && UUID_PATTERN.test(value)
    ? value
    : undefined;
}

export function createBatchItemRequestKey(batchRequestKey: string, itemIndex: number, productId: string) {
  return uuidV5(`${batchRequestKey}:${itemIndex}:${productId}`, BATCH_ITEM_NAMESPACE);
}

export function fingerprintBatchRequest(input: {
  batchRequestKey: string;
  productIds: readonly string[];
  requestMode: AuroraRequestMode;
  requestedById: string;
}) {
  return sha256(stableJson(input));
}

export function buildEvaluationContextIdentity(
  product: AuroraCatalogProduct,
  binding: AuroraProductBinding,
): EvaluationContextIdentity {
  const customization = inspectCustomizationSchema(product.customizationFields);
  const inputSnapshot = {
    productId: product.id,
    slug: product.slug,
    adminStatus: product.adminStatus,
    active: product.isActive,
    archived: product.archivedAt !== null,
    inventoryAvailable: product.inventory > 0,
    leadTime: { minimumDays: product.handmadeDaysMin, maximumDays: product.handmadeDaysMax },
    requiredContent: {
      categoryPresent: product.categoryId.trim().length > 0,
      descriptionPresent: product.description.trim().length > 0,
      storyPresent: product.story.trim().length > 0,
      imagePresent: product.imageUrl.trim().length > 0,
    },
    customizationSchema: customization,
    approvedExplicitFacts: [...binding.approvedExplicitFacts].sort(),
  };
  const inputSnapshotJson = stableJson(inputSnapshot);
  const bindingFingerprint = sha256(stableJson(binding));
  const bindingManifestFingerprint = sha256(stableJson(auroraProductBindings));
  const runtimeContractsJson = stableJson(deployment.compatibility);
  const applicationContextFingerprint = sha256(
    stableJson({
      inputSnapshot,
      bindingId: binding.bindingId,
      bindingFingerprint,
      projectId: binding.projectId,
      bundleFingerprint: deployment.bundle.projectFingerprint,
      bundleSha256: deployment.bundle.sha256,
      sdkVersion: deployment.sdk.version,
      runtimeContracts: deployment.compatibility,
    }),
  );
  return Object.freeze({
    inputSnapshotJson,
    applicationContextFingerprint,
    bindingFingerprint,
    bindingManifestFingerprint,
    runtimeContractsJson,
  });
}

export function serializeRequestIdentity(identity: EvaluationRequestIdentity) {
  const json = stableJson(identity);
  return Object.freeze({ json, fingerprint: sha256(json) });
}

export function stableJson(value: unknown): string {
  return serializeStable(normalize(value, "$"));
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function inspectCustomizationSchema(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    const valid =
      Array.isArray(parsed) &&
      parsed.every(
        (field) =>
          isRecord(field) &&
          typeof field.name === "string" &&
          typeof field.label === "string" &&
          ["text", "textarea", "select"].includes(String(field.type)),
      );
    return { valid, fingerprint: sha256(stableJson(parsed)) };
  } catch {
    return { valid: false, fingerprint: sha256(value) };
  }
}

function uuidV5(name: string, namespace: string) {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const bytes = createHash("sha1").update(namespaceBytes).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type StableValue = null | string | number | boolean | StableValue[] | { [key: string]: StableValue };

function normalize(value: unknown, path: string): StableValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Non-finite value at ${path}.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${path}[${index}]`));
  if (isRecord(value)) {
    const result: Record<string, StableValue> = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item === undefined) continue;
      result[key] = normalize(item, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`Non-JSON value at ${path}.`);
}

function serializeStable(value: StableValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serializeStable).join(",")}]`;
  return `{${Object.entries(value)
    .map(([key, item]) => `${JSON.stringify(key)}:${serializeStable(item)}`)
    .join(",")}}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
