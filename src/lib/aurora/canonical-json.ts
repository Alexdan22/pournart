import { createHash } from "node:crypto";

type StableValue = null | string | number | boolean | StableValue[] | { [key: string]: StableValue };

export function stableJson(value: unknown): string {
  return serializeStable(normalize(value, "$"));
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

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
