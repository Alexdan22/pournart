import { describe, expect, it, vi } from "vitest";
import {
  createBatchItemRequestKey,
  createRequestKey,
  fingerprintBatchRequest,
  parseRequestKey,
  serializeRequestIdentity,
  type EvaluationRequestIdentity,
} from "./identity";
import {
  AuroraIdempotencyConflictError,
  withBatchSingleFlight,
  withEvaluationSingleFlight,
} from "./idempotency";
import {
  AURORA_RESULT_LIMIT_BYTES,
  AuroraSerializationError,
  parseStoredAuroraResult,
  serializeAuroraResult,
  verifyStoredAuroraResult,
} from "./serialization";
import type { AuroraEvaluationView } from "./types";

describe("Aurora request identity", () => {
  it("accepts canonical UUID v4/v5 keys and rejects malformed keys", () => {
    const generated = createRequestKey();
    expect(parseRequestKey(generated)).toBe(generated);
    const item = createBatchItemRequestKey(generated, 0, "product.one");
    expect(parseRequestKey(item)).toBe(item);
    expect(parseRequestKey(generated.toUpperCase())).toBeUndefined();
    expect(parseRequestKey("not-a-request-key")).toBeUndefined();
  });

  it("separates products, modes, context fingerprints, and admins", () => {
    const base = requestIdentity();
    const fingerprints = [
      base,
      { ...base, productId: "product.two" },
      { ...base, requestMode: "RETRY" as const },
      { ...base, applicationContextFingerprint: "context.two" },
      { ...base, requestedById: "admin.two" },
    ].map((value) => serializeRequestIdentity(value).fingerprint);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it("reproduces item keys within a batch and partitions different batches", () => {
    const firstBatch = createRequestKey();
    const secondBatch = createRequestKey();
    expect(createBatchItemRequestKey(firstBatch, 2, "product.one")).toBe(
      createBatchItemRequestKey(firstBatch, 2, "product.one"),
    );
    expect(createBatchItemRequestKey(firstBatch, 2, "product.one")).not.toBe(
      createBatchItemRequestKey(secondBatch, 2, "product.one"),
    );
    expect(
      fingerprintBatchRequest({
        batchRequestKey: firstBatch,
        productIds: ["one", "two"],
        requestMode: "REUSE_CURRENT",
        requestedById: "admin.one",
      }),
    ).not.toBe(
      fingerprintBatchRequest({
        batchRequestKey: firstBatch,
        productIds: ["two", "one"],
        requestMode: "REUSE_CURRENT",
        requestedById: "admin.one",
      }),
    );
  });

  it("joins concurrent identical requests and rejects a concurrent identity collision", async () => {
    const key = createRequestKey();
    const operation = vi.fn(async () => {
      await Promise.resolve();
      return successView();
    });
    const [first, second] = await Promise.all([
      withEvaluationSingleFlight(key, "identity.one", operation),
      withEvaluationSingleFlight(key, "identity.one", operation),
    ]);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);

    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = withEvaluationSingleFlight(key, "identity.one", async () => {
      await pending;
      return successView();
    });
    await expect(
      withEvaluationSingleFlight(key, "identity.two", async () => successView()),
    ).rejects.toBeInstanceOf(AuroraIdempotencyConflictError);
    release();
    await running;
  });

  it("joins a batch retry and rejects a cross-identity batch collision", async () => {
    const key = createRequestKey();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = withBatchSingleFlight(key, "batch.one", async () => {
      await pending;
      return ["complete"];
    });
    const retry = withBatchSingleFlight(key, "batch.one", async () => ["wrong"]);
    await expect(withBatchSingleFlight(key, "batch.two", async () => [])).rejects.toBeInstanceOf(
      AuroraIdempotencyConflictError,
    );
    release();
    await expect(first).resolves.toEqual(["complete"]);
    await expect(retry).resolves.toEqual(["complete"]);
  });
});

describe("Aurora result serialization", () => {
  it("round-trips JSON-safe output and records exact bytes", () => {
    const response = { ok: true as const, domain: { decisions: [] }, trace: { projectId: "project.one" } };
    const serialized = serializeAuroraResult(response);
    expect(serialized.bytes).toBe(Buffer.byteLength(serialized.json));
    expect(parseStoredAuroraResult(serialized.json)).toEqual(response);
    expect(verifyStoredAuroraResult(serialized.json, serialized.sha256, serialized.bytes)).toEqual(response);
    expect(() => verifyStoredAuroraResult(serialized.json, "wrong", serialized.bytes)).toThrow(
      "STORED_RESULT_CHECKSUM_MISMATCH",
    );
  });

  it("rejects output over 256 KiB", () => {
    const response = {
      ok: true as const,
      domain: { value: "x".repeat(AURORA_RESULT_LIMIT_BYTES) },
      trace: { projectId: "project.one" },
    };
    expect(() => serializeAuroraResult(response)).toThrow(AuroraSerializationError);
  });

  it("rejects values that JSON serialization would silently change", () => {
    expect(() =>
      serializeAuroraResult({
        ok: true,
        domain: { unsafe: undefined },
        trace: { projectId: "project.one" },
      } as never),
    ).toThrow(AuroraSerializationError);
    expect(() =>
      serializeAuroraResult({
        ok: true,
        domain: { unsafe: Number.NaN },
        trace: { projectId: "project.one" },
      } as never),
    ).toThrow(AuroraSerializationError);
  });
});

function requestIdentity(): EvaluationRequestIdentity {
  return {
    operationType: "PRODUCT_EVALUATION",
    requestMode: "REEVALUATE",
    productId: "product.one",
    productSlug: "product-one",
    bindingId: "binding.one",
    bindingFingerprint: "binding.fingerprint",
    applicationContextFingerprint: "context.one",
    requestedById: "admin.one",
  };
}

function successView(): AuroraEvaluationView {
  return {
    state: "success",
    productId: "product.one",
    slug: "product-one",
    productName: "Product one",
    binding: {
      state: "active",
      bindingId: "binding.pna.ocean-bloom-coaster-set",
      expectedSlug: "ocean-bloom-coaster-set",
      expectedDatabaseIds: {},
      projectId: "project.pna.catalog-intelligence-pilot",
      productDnaArtifactId: "artifact.pna.product.ocean-bloom-coaster-set",
      productDnaProductId: "product.pna.ocean-bloom-coaster-set",
      ruleSetArtifactId: "artifact.pna.ruleset.catalog-readiness",
      ruleSetDomainId: "ruleset.pna.catalog-readiness",
      approvedExplicitFacts: [],
      entryFingerprint: "binding-fingerprint",
    },
    response: { ok: true, domain: {}, trace: {} },
    health: {
      ok: true,
      sdkVersion: "1.0.0-pilot.1",
      sdkSourceCommit: "source",
      sdkSha256: "sdk",
      bundleSha256: "bundle",
      projectId: "project.pna.catalog-intelligence-pilot",
      issueCodes: [],
    },
    evaluatedAt: "2026-07-13T00:00:00.000Z",
  };
}
