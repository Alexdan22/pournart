import "server-only";

import type { AuroraEvaluation, Prisma } from "@prisma/client";
import type { AuroraIntelligenceResponseDto } from "@aurora/sdk/integration";
import { prisma } from "@/lib/db";
import { runSerializedAuroraWrite } from "./database";
import type { AuroraProductBinding } from "./bindings";
import {
  serializeRequestIdentity,
  type EvaluationContextIdentity,
  type EvaluationRequestIdentity,
} from "./identity";
import { safeIssueCodes, serializeAuroraResult, validateInputSnapshot, verifyStoredAuroraResult } from "./serialization";
import { auroraDeployment, auroraInitialization } from "./runtime";
import type { AuroraCatalogProduct, AuroraEvaluationView } from "./types";
import { AuroraIdempotencyConflictError } from "./idempotency";

const CACHE_CAPACITY = 200;

type PersistenceGlobal = typeof globalThis & {
  __pnaAuroraEvaluationCache?: Map<string, AuroraEvaluationView>;
};

const state = globalThis as PersistenceGlobal;
const evaluationCache = state.__pnaAuroraEvaluationCache ?? new Map<string, AuroraEvaluationView>();
state.__pnaAuroraEvaluationCache = evaluationCache;

export type PersistEvaluationInput = Readonly<{
  product: AuroraCatalogProduct;
  binding: AuroraProductBinding;
  context: EvaluationContextIdentity;
  requestKey: string;
  requestIdentity: EvaluationRequestIdentity;
  trigger: string;
  response: AuroraIntelligenceResponseDto;
  durationMs: number;
}>;

export async function findEvaluationByRequestKey(requestKey: string) {
  return prisma.auroraEvaluation.findUnique({ where: { requestKey } });
}

export async function findCurrentSuccessfulEvaluation(productId: string, applicationContextFingerprint: string) {
  return prisma.auroraEvaluation.findFirst({
    where: { productId, applicationContextFingerprint, status: "SUCCEEDED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function findLatestEvaluationAttempt(productId: string) {
  return prisma.auroraEvaluation.findFirst({
    where: { productId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function findLatestSuccessfulEvaluation(productId: string) {
  return prisma.auroraEvaluation.findFirst({
    where: { productIdAtExecution: productId, status: "SUCCEEDED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function findLatestFailedEvaluation(productId: string, applicationContextFingerprint?: string) {
  return prisma.auroraEvaluation.findFirst({
    where: {
      productIdAtExecution: productId,
      status: "FAILED",
      ...(applicationContextFingerprint ? { applicationContextFingerprint } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function validateBatchIdentity(batchRequestKey: string, batchIdentityFingerprint: string) {
  const existing = await prisma.auroraEvaluation.findFirst({
    where: { batchRequestKey },
    select: { batchIdentityFingerprint: true },
  });
  return existing === null || existing.batchIdentityFingerprint === batchIdentityFingerprint;
}

export async function persistEvaluation(input: PersistEvaluationInput) {
  const serializedIdentity = serializeRequestIdentity(input.requestIdentity);
  const trace = record(input.response.trace);
  const artifactFingerprints = record(trace.artifactFingerprints);
  let status: string = input.response.ok ? "SUCCEEDED" : "FAILED";
  let failureStage: string | null = input.response.ok ? null : input.response.stage;
  let issueCodes = safeIssueCodes(input.response);
  let serialized: ReturnType<typeof serializeAuroraResult> | undefined;
  if (input.response.ok) {
    try {
      serialized = serializeAuroraResult(input.response);
    } catch (error) {
      status = "FAILED";
      failureStage = "serialization";
      issueCodes = Object.freeze([
        error instanceof Error && error.name === "AuroraSerializationError"
          ? error.message
          : "INVALID_RESULT_JSON",
      ]);
    }
  }
  validateInputSnapshot(input.context.inputSnapshotJson);

  const data: Prisma.AuroraEvaluationUncheckedCreateInput = {
    requestKey: input.requestKey,
    requestIdentityJson: serializedIdentity.json,
    requestIdentityFingerprint: serializedIdentity.fingerprint,
    operationType: input.requestIdentity.operationType,
    requestMode: input.requestIdentity.requestMode,
    trigger: input.trigger,
    requestedById: input.requestIdentity.requestedById,
    requestedByIdAtExecution: input.requestIdentity.requestedById,
    batchRequestKey: input.requestIdentity.batchRequestKey,
    batchIdentityFingerprint: input.requestIdentity.batchIdentityFingerprint,
    batchItemIndex: input.requestIdentity.batchItemIndex,
    batchSize: input.requestIdentity.batchSize,
    productId: input.product.id,
    productIdAtExecution: input.product.id,
    productSlug: input.product.slug,
    productName: input.product.name,
    bindingId: input.binding.bindingId,
    bindingFingerprint: input.context.bindingFingerprint,
    bindingManifestFingerprint: input.context.bindingManifestFingerprint,
    projectId: input.binding.projectId,
    bundleFingerprint: auroraDeployment.bundle.projectFingerprint,
    bundleSha256: auroraDeployment.bundle.sha256,
    sdkVersion: auroraDeployment.sdk.version,
    runtimeContractsJson: input.context.runtimeContractsJson,
    productDnaArtifactId: input.binding.productDnaArtifactId,
    productDnaProductId: input.binding.productDnaProductId,
    productDnaFingerprint: fingerprintValue(artifactFingerprints.product),
    ruleSetArtifactId: input.binding.ruleSetArtifactId,
    ruleSetDomainId: input.binding.ruleSetDomainId,
    ruleSetFingerprint: fingerprintValue(artifactFingerprints.ruleset),
    applicationContextFingerprint: input.context.applicationContextFingerprint,
    auroraInputFingerprint: fingerprintValue(trace.inputFingerprint),
    auroraOutputFingerprint: fingerprintValue(trace.outputFingerprint),
    inputSnapshotJson: input.context.inputSnapshotJson,
    resultJson: serialized?.json,
    resultSha256: serialized?.sha256,
    resultBytes: serialized?.bytes,
    status,
    failureStage,
    issueCodesJson: JSON.stringify(issueCodes),
    durationMs: Math.max(0, Math.round(input.durationMs)),
  };

  return runSerializedAuroraWrite(async (client) => {
    const existing = await client.auroraEvaluation.findUnique({ where: { requestKey: input.requestKey } });
    if (existing) return verifyExistingIdentity(existing, serializedIdentity.fingerprint);
    try {
      return await client.auroraEvaluation.create({ data });
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const raced = await client.auroraEvaluation.findUnique({ where: { requestKey: input.requestKey } });
      if (!raced) throw error;
      return verifyExistingIdentity(raced, serializedIdentity.fingerprint);
    }
  });
}

export function evaluationFromRecord(
  recordValue: AuroraEvaluation,
  binding: AuroraProductBinding,
  lookupSource: "process-cache" | "database" | "runtime",
  metadata?: Pick<Extract<AuroraEvaluationView, { state: "success" }>, "cacheStatus" | "lifecycle">,
): AuroraEvaluationView {
  if (recordValue.status !== "SUCCEEDED" || !recordValue.resultJson)
    return {
      state: "validation-failure",
      message: "The latest Aurora execution did not complete successfully.",
      productId: recordValue.productIdAtExecution,
      binding,
      response: failureResponse(recordValue),
    };
  try {
    return {
      state: "success",
      productId: recordValue.productIdAtExecution,
      slug: recordValue.productSlug,
      productName: recordValue.productName,
      binding,
      response: verifyStoredAuroraResult(
        recordValue.resultJson,
        recordValue.resultSha256,
        recordValue.resultBytes,
      ),
      health: auroraInitialization.health,
      evaluatedAt: recordValue.createdAt.toISOString(),
      evaluationId: recordValue.id,
      requestKey: recordValue.requestKey,
      lookupSource,
      ...metadata,
    };
  } catch {
    return {
      state: "persistence-failure",
      productId: recordValue.productIdAtExecution,
      issueCode: "AURORA_STORED_RESULT_INVALID",
      message: "The stored Aurora result failed integrity validation.",
    };
  }
}

export function cachedEvaluation(contextFingerprint: string) {
  const value = evaluationCache.get(contextFingerprint);
  return value?.state === "success" ? { ...value, lookupSource: "process-cache" as const } : undefined;
}

export function cacheEvaluation(contextFingerprint: string, value: AuroraEvaluationView) {
  if (value.state !== "success") return;
  if (!evaluationCache.has(contextFingerprint) && evaluationCache.size >= CACHE_CAPACITY) {
    const oldest = evaluationCache.keys().next().value;
    if (oldest) evaluationCache.delete(oldest);
  }
  evaluationCache.set(contextFingerprint, value);
}

export function invalidateCachedEvaluation(contextFingerprint: string) {
  evaluationCache.delete(contextFingerprint);
}

export function clearPersistedEvaluationCache() {
  evaluationCache.clear();
}

function verifyExistingIdentity(recordValue: AuroraEvaluation, expectedFingerprint: string) {
  if (recordValue.requestIdentityFingerprint !== expectedFingerprint)
    throw new AuroraIdempotencyConflictError();
  return recordValue;
}

function failureResponse(recordValue: AuroraEvaluation): AuroraIntelligenceResponseDto {
  const allowedStages = new Set(["request", "resolution", "reasoning", "projection"]);
  const stage = allowedStages.has(recordValue.failureStage ?? "")
    ? (recordValue.failureStage as "request" | "resolution" | "reasoning" | "projection")
    : "request";
  return {
    ok: false,
    stage,
    issues: JSON.parse(recordValue.issueCodesJson).map((code: string) => ({ code })),
    trace: {
      projectId: recordValue.projectId,
      inputFingerprint: recordValue.auroraInputFingerprint
        ? { algorithm: "sha256", canonicalization: "aurora-json-v1", value: recordValue.auroraInputFingerprint }
        : null,
    },
  };
}

function fingerprintValue(value: unknown) {
  return isRecord(value) && typeof value.value === "string" ? value.value : null;
}

function isUniqueConflict(error: unknown) {
  return isRecord(error) && error.code === "P2002";
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
