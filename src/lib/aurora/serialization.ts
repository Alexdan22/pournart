import type { AuroraIntelligenceResponseDto } from "@aurora/sdk/integration";
import { sha256 } from "./identity";

export const AURORA_RESULT_LIMIT_BYTES = 256 * 1024;
export const AURORA_INPUT_LIMIT_BYTES = 32 * 1024;
export const AURORA_ISSUE_CODE_LIMIT = 64;
export const AURORA_ISSUE_CODE_LENGTH = 128;

export type SerializedAuroraResult = Readonly<{
  json: string;
  sha256: string;
  bytes: number;
}>;

export function serializeAuroraResult(response: AuroraIntelligenceResponseDto): SerializedAuroraResult {
  validateResponse(response);
  assertJsonSafe(response, "$", new Set());
  const json = JSON.stringify(response);
  assertJsonSafe(JSON.parse(json), "$", new Set());
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > AURORA_RESULT_LIMIT_BYTES) throw new AuroraSerializationError("RESULT_TOO_LARGE");
  return Object.freeze({ json, sha256: sha256(json), bytes });
}

export function validateInputSnapshot(json: string) {
  assertJsonSafe(JSON.parse(json), "$", new Set());
  if (Buffer.byteLength(json, "utf8") > AURORA_INPUT_LIMIT_BYTES)
    throw new AuroraSerializationError("INPUT_SNAPSHOT_TOO_LARGE");
  return json;
}

export function parseStoredAuroraResult(json: string): AuroraIntelligenceResponseDto {
  const value = JSON.parse(json) as unknown;
  assertJsonSafe(value, "$", new Set());
  validateResponse(value);
  return value;
}

export function verifyStoredAuroraResult(json: string, expectedSha256: string | null, expectedBytes: number | null) {
  const bytes = Buffer.byteLength(json, "utf8");
  if (!expectedSha256 || !expectedBytes || sha256(json) !== expectedSha256 || bytes !== expectedBytes)
    throw new AuroraSerializationError("STORED_RESULT_CHECKSUM_MISMATCH");
  return parseStoredAuroraResult(json);
}

export function safeIssueCodes(response: AuroraIntelligenceResponseDto): readonly string[] {
  if (response.ok) return Object.freeze([]);
  const issues = Array.isArray(response.issues) ? response.issues : [];
  return Object.freeze(
    issues
      .flatMap((issue) => {
        const code = isRecord(issue) && typeof issue.code === "string" ? issue.code.trim() : "";
        return code && code.length <= AURORA_ISSUE_CODE_LENGTH ? [code] : [];
      })
      .slice(0, AURORA_ISSUE_CODE_LIMIT),
  );
}

export class AuroraSerializationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "AuroraSerializationError";
  }
}

function validateResponse(value: unknown): asserts value is AuroraIntelligenceResponseDto {
  if (!isRecord(value) || typeof value.ok !== "boolean" || !isRecord(value.trace))
    throw new AuroraSerializationError("INVALID_RESULT_JSON");
  if (value.ok) {
    if (!isRecord(value.domain)) throw new AuroraSerializationError("INVALID_RESULT_JSON");
    return;
  }
  if (
    !["request", "resolution", "reasoning", "projection"].includes(String(value.stage)) ||
    !Array.isArray(value.issues)
  )
    throw new AuroraSerializationError("INVALID_RESULT_JSON");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertJsonSafe(value: unknown, path: string, seen: Set<object>): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new AuroraSerializationError("INVALID_RESULT_JSON");
    return;
  }
  if (typeof value !== "object") throw new AuroraSerializationError("INVALID_RESULT_JSON");
  if (seen.has(value)) throw new AuroraSerializationError("INVALID_RESULT_JSON");
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      throw new AuroraSerializationError("INVALID_RESULT_JSON");
    for (const [key, item] of Object.entries(value))
      assertJsonSafe(item, `${path}.${key}`, seen);
  }
  seen.delete(value);
}
