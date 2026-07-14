import { NextResponse } from "next/server";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { evaluateProductIntelligence } from "@/lib/aurora/adapter";
import { mapWithConcurrency, validateBatchProductIds } from "@/lib/aurora/batch";
import {
  createBatchItemRequestKey,
  createRequestKey,
  fingerprintBatchRequest,
  parseRequestKey,
  type AuroraRequestMode,
} from "@/lib/aurora/identity";
import {
  validateBatchIdentity,
} from "@/lib/aurora/persistence";
import { AuroraIdempotencyConflictError, withBatchSingleFlight } from "@/lib/aurora/idempotency";

export async function POST(request: Request) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => null)) as {
    productIds?: unknown;
    batchRequestKey?: unknown;
    mode?: unknown;
  } | null;
  const parsed = validateBatchProductIds(body?.productIds);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const requestMode = parseMode(body?.mode);
  if (!requestMode) return NextResponse.json({ ok: false, error: "Invalid evaluation mode." }, { status: 400 });
  const batchRequestKey =
    body?.batchRequestKey === undefined ? createRequestKey() : parseRequestKey(body.batchRequestKey);
  if (!batchRequestKey)
    return NextResponse.json(
      { ok: false, error: "Batch request key must be a canonical UUID v4 or v5." },
      { status: 400 },
    );
  const batchIdentityFingerprint = fingerprintBatchRequest({
    batchRequestKey,
    productIds: parsed.productIds,
    requestMode,
    requestedById: access.session.id,
  });
  if (!(await validateBatchIdentity(batchRequestKey, batchIdentityFingerprint)))
    return conflictResponse();

  try {
    return await withBatchSingleFlight(batchRequestKey, batchIdentityFingerprint, async () => {
      const results = await mapWithConcurrency(parsed.productIds, 4, async (productId, index) => {
        try {
          return await evaluateProductIntelligence(productId, {
            requestedById: access.session.id,
            requestKey: createBatchItemRequestKey(batchRequestKey, index, productId),
            requestMode,
            operationType: "CATALOG_BATCH_ITEM",
            trigger: "catalog-batch",
            batchRequestKey,
            batchIdentityFingerprint,
            batchItemIndex: index,
            batchSize: parsed.productIds.length,
          });
        } catch {
          return {
            state: "runtime-failure" as const,
            productId,
            message: "Unexpected evaluation failure.",
            health: failureHealth,
          };
        }
      });
      return NextResponse.json({
        ok: results.every((item) => item.state === "success"),
        batchRequestKey,
        results,
      });
    });
  } catch (error) {
    if (error instanceof AuroraIdempotencyConflictError) return conflictResponse();
    throw error;
  }
}

function parseMode(value: unknown): AuroraRequestMode | undefined {
  if (value === undefined || value === "reuse-current") return "REUSE_CURRENT";
  if (value === "re-evaluate") return "REEVALUATE";
  if (value === "retry") return "RETRY";
  return undefined;
}

function conflictResponse() {
  return NextResponse.json(
    { ok: false, code: "IDEMPOTENCY_CONFLICT", error: "This batch request key belongs to another request." },
    { status: 409 },
  );
}

const failureHealth = {
  ok: false,
  sdkVersion: "unknown",
  sdkSourceCommit: "unknown",
  sdkSha256: "unknown",
  bundleSha256: "unknown",
  projectId: "unknown",
  issueCodes: ["UNEXPECTED_BATCH_FAILURE"],
} as const;
