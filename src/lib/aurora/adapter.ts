import "server-only";

import { prisma } from "@/lib/db";
import { buildAuroraExplicitReferences } from "./assertions";
import { resolveAuroraBinding } from "./bindings";
import {
  buildEvaluationContextIdentity,
  createRequestKey,
  serializeRequestIdentity,
  sha256,
  type AuroraOperationType,
  type AuroraRequestMode,
  type EvaluationRequestIdentity,
} from "./identity";
import {
  cacheEvaluation,
  cachedEvaluation,
  clearPersistedEvaluationCache,
  evaluationFromRecord,
  findCurrentSuccessfulEvaluation,
  findEvaluationByRequestKey,
  findLatestFailedEvaluation,
  findLatestEvaluationAttempt,
  findLatestSuccessfulEvaluation,
  invalidateCachedEvaluation,
  persistEvaluation,
} from "./persistence";
import { AuroraIdempotencyConflictError, withEvaluationSingleFlight } from "./idempotency";
import { AuroraPersistenceBusyError } from "./database";
import { auroraDeployment, auroraInitialization } from "./runtime";
import { deriveEvaluationLifecycle } from "./lifecycle";
import type { AuroraCatalogProduct, AuroraEvaluationView } from "./types";

export type EvaluateProductOptions = Readonly<{
  requestedById: string;
  requestKey?: string;
  requestMode?: AuroraRequestMode;
  operationType?: AuroraOperationType;
  trigger?: string;
  batchRequestKey?: string;
  batchIdentityFingerprint?: string;
  batchItemIndex?: number;
  batchSize?: number;
}>;

export async function evaluateProductIntelligence(
  productId: string,
  options: EvaluateProductOptions,
): Promise<AuroraEvaluationView> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product)
    return { state: "missing-product", message: "Product not found.", productId };
  const bindingResolution = resolveAuroraBinding(product);
  if (!bindingResolution.ok)
    return { state: bindingResolution.state, message: bindingResolution.message, productId: product.id };

  const requestKey = options.requestKey ?? createRequestKey();
  const requestMode = options.requestMode ?? "REUSE_CURRENT";
  const context = buildEvaluationContextIdentity(product, bindingResolution.binding);
  const requestIdentity: EvaluationRequestIdentity = Object.freeze({
    operationType: options.operationType ?? "PRODUCT_EVALUATION",
    requestMode,
    productId: product.id,
    productSlug: product.slug,
    bindingId: bindingResolution.binding.bindingId,
    bindingFingerprint: context.bindingFingerprint,
    applicationContextFingerprint: context.applicationContextFingerprint,
    requestedById: options.requestedById,
    ...(options.batchRequestKey ? { batchRequestKey: options.batchRequestKey } : {}),
    ...(options.batchIdentityFingerprint
      ? { batchIdentityFingerprint: options.batchIdentityFingerprint }
      : {}),
    ...(options.batchItemIndex === undefined ? {} : { batchItemIndex: options.batchItemIndex }),
    ...(options.batchSize === undefined ? {} : { batchSize: options.batchSize }),
  });
  const requestIdentityFingerprint = serializeRequestIdentity(requestIdentity).fingerprint;

  return withEvaluationSingleFlight(requestKey, requestIdentityFingerprint, async () => {
    try {
      const existing = await findEvaluationByRequestKey(requestKey);
      if (existing) {
        const expected = serializeRequestIdentity(requestIdentity).fingerprint;
        if (existing.requestIdentityFingerprint !== expected) throw new AuroraIdempotencyConflictError();
        const lifecycle = deriveEvaluationLifecycle({
          evaluation: existing,
          product,
          binding: bindingResolution.binding,
          context,
        });
        logLookup(product.id, requestMode, "database", "hit", 0);
        return evaluationFromRecord(existing, bindingResolution.binding, "database", {
          cacheStatus: "hit",
          lifecycle,
        });
      }
      if (requestMode === "REUSE_CURRENT") {
        const cached = cachedEvaluation(context.applicationContextFingerprint);
        if (cached) {
          logLookup(product.id, requestMode, "process-cache", "hit", 0);
          return { ...cached, cacheStatus: "hit" };
        }
        const persisted = await findCurrentSuccessfulEvaluation(
          product.id,
          context.applicationContextFingerprint,
        );
        if (persisted) {
          const latestFailure = await findLatestFailedEvaluation(
            product.id,
            context.applicationContextFingerprint,
          );
          const lifecycle = deriveEvaluationLifecycle({
            evaluation: persisted,
            product,
            binding: bindingResolution.binding,
            context,
            latestFailure,
          });
          const view = evaluationFromRecord(persisted, bindingResolution.binding, "database", {
            cacheStatus: "hit",
            lifecycle,
          });
          cacheEvaluation(context.applicationContextFingerprint, view);
          logLookup(product.id, requestMode, "database", "hit", 0);
          return view;
        }
        logLookup(product.id, requestMode, "runtime", "miss", 0);
      } else if (requestMode === "RETRY") {
        const latestFailure = await findLatestFailedEvaluation(
          product.id,
          context.applicationContextFingerprint,
        );
        if (!latestFailure) {
          const persisted = await findCurrentSuccessfulEvaluation(
            product.id,
            context.applicationContextFingerprint,
          );
          if (persisted) {
            const lifecycle = deriveEvaluationLifecycle({
              evaluation: persisted,
              product,
              binding: bindingResolution.binding,
              context,
            });
            logLookup(product.id, requestMode, "database", "hit", 0);
            return evaluationFromRecord(persisted, bindingResolution.binding, "database", {
              cacheStatus: "hit",
              lifecycle,
            });
          }
        }
        logLookup(product.id, requestMode, "runtime", "bypass", 0);
      } else {
        logLookup(product.id, requestMode, "runtime", "bypass", 0);
      }
      if (!auroraInitialization.ok)
        return {
          state: "runtime-failure",
          message: "Aurora is unavailable because its validated project could not be initialized.",
          productId: product.id,
          health: auroraInitialization.health,
        };

      const startedAt = performance.now();
      const response = auroraInitialization.service.execute({
        ruleSet: { kind: "ruleset", artifactId: bindingResolution.binding.ruleSetArtifactId },
        product: { kind: "product-dna", artifactId: bindingResolution.binding.productDnaArtifactId },
        explicitReferences: buildAuroraExplicitReferences(product, bindingResolution.binding),
      });
      const record = await persistEvaluation({
        product,
        binding: bindingResolution.binding,
        context,
        requestKey,
        requestIdentity,
        trigger: options.trigger ?? "product",
        response,
        durationMs: performance.now() - startedAt,
      });
      const lifecycle = deriveEvaluationLifecycle({
        evaluation: record,
        product,
        binding: bindingResolution.binding,
        context,
      });
      const view = evaluationFromRecord(record, bindingResolution.binding, "runtime", {
        cacheStatus: requestMode === "REUSE_CURRENT" ? "miss" : "bypass",
        lifecycle,
      });
      if (view.state !== "success") invalidateCachedEvaluation(context.applicationContextFingerprint);
      cacheEvaluation(context.applicationContextFingerprint, view);
      console.info(
        JSON.stringify({
          event: "aurora.product-evaluation",
          productId: product.id,
          bindingId: bindingResolution.binding.bindingId,
          projectId: bindingResolution.binding.projectId,
          bundleFingerprint: auroraDeployment.bundle.projectFingerprint,
          sdkVersion: auroraDeployment.sdk.version,
          stage: response.ok ? "success" : response.stage,
          lookupSource: "runtime",
          cacheStatus: requestMode === "REUSE_CURRENT" ? "miss" : "bypass",
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        }),
      );
      return view;
    } catch (error) {
      if (error instanceof AuroraIdempotencyConflictError) {
        console.info(
          JSON.stringify({
            event: "aurora.idempotency-conflict",
            issueCode: error.code,
            requestKeyHash: sha256(requestKey).slice(0, 12),
            productId: product.id,
          }),
        );
        return {
          state: "idempotency-conflict",
          productId: product.id,
          issueCode: "IDEMPOTENCY_CONFLICT",
          message: "This request key belongs to a different evaluation request.",
        };
      }
      if (error instanceof AuroraPersistenceBusyError)
        return {
          state: "persistence-failure",
          productId: product.id,
          issueCode: error.code,
          message: "Aurora completed no durable write because the evaluation database was busy.",
        };
      return {
        state: "persistence-failure",
        productId: product.id,
        issueCode: "AURORA_PERSISTENCE_FAILURE",
        message: "Aurora could not store this evaluation. Storefront and checkout remain available.",
      };
    }
  }).catch((error: unknown) => {
    if (!(error instanceof AuroraIdempotencyConflictError)) throw error;
    console.info(
      JSON.stringify({
        event: "aurora.idempotency-conflict",
        issueCode: error.code,
        requestKeyHash: sha256(requestKey).slice(0, 12),
        productId: product.id,
      }),
    );
    return {
      state: "idempotency-conflict" as const,
      productId: product.id,
      issueCode: "IDEMPOTENCY_CONFLICT" as const,
      message: "This request key belongs to a different evaluation request.",
    };
  });
}

export function evaluateCatalogProduct(product: AuroraCatalogProduct): AuroraEvaluationView {
  const resolved = resolveAuroraBinding(product);
  if (!resolved.ok)
    return { state: resolved.state, message: resolved.message, productId: product.id };
  if (!auroraInitialization.ok)
    return {
      state: "runtime-failure",
      message: "Aurora is unavailable because its validated project could not be initialized.",
      productId: product.id,
      health: auroraInitialization.health,
    };
  const response = auroraInitialization.service.execute({
    ruleSet: { kind: "ruleset", artifactId: resolved.binding.ruleSetArtifactId },
    product: { kind: "product-dna", artifactId: resolved.binding.productDnaArtifactId },
    explicitReferences: buildAuroraExplicitReferences(product, resolved.binding),
  });
  if (!response.ok)
    return {
      state: "validation-failure",
      message: "Aurora could not validate or execute this approved product binding.",
      productId: product.id,
      binding: resolved.binding,
      response,
    };
  return {
    state: "success",
    productId: product.id,
    slug: product.slug,
    productName: product.name,
    binding: resolved.binding,
    response,
    health: auroraInitialization.health,
    evaluatedAt: new Date().toISOString(),
    lookupSource: "runtime",
  };
}

export async function getLatestProductIntelligence(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return undefined;
  const resolved = resolveAuroraBinding(product);
  if (!resolved.ok) return undefined;
  const context = buildEvaluationContextIdentity(product, resolved.binding);
  const cached = cachedEvaluation(context.applicationContextFingerprint);
  if (cached) return { ...cached, cacheStatus: "hit" as const };
  const latestFailure = await findLatestFailedEvaluation(product.id);
  const current = await findCurrentSuccessfulEvaluation(product.id, context.applicationContextFingerprint);
  if (current) {
    const lifecycle = deriveEvaluationLifecycle({
      evaluation: current,
      product,
      binding: resolved.binding,
      context,
      latestFailure,
    });
    const view = evaluationFromRecord(current, resolved.binding, "database", {
      cacheStatus: "hit",
      lifecycle,
    });
    cacheEvaluation(context.applicationContextFingerprint, view);
    return view;
  }
  const latestSuccess = await findLatestSuccessfulEvaluation(product.id);
  if (latestSuccess) {
    const lifecycle = deriveEvaluationLifecycle({
      evaluation: latestSuccess,
      product,
      binding: resolved.binding,
      context,
      latestFailure,
    });
    return evaluationFromRecord(latestSuccess, resolved.binding, "database", {
      cacheStatus: "miss",
      lifecycle,
    });
  }
  const latest = await findLatestEvaluationAttempt(product.id);
  return latest ? evaluationFromRecord(latest, resolved.binding, "database") : undefined;
}

export function clearLatestProductIntelligence() {
  clearPersistedEvaluationCache();
}

function logLookup(
  productId: string,
  requestMode: AuroraRequestMode,
  lookupSource: "process-cache" | "database" | "runtime",
  cacheStatus: "hit" | "miss" | "bypass",
  durationMs: number,
) {
  console.info(
    JSON.stringify({
      event: "aurora.evaluation-lookup",
      productId,
      requestMode,
      lookupSource,
      cacheStatus,
      durationMs: Math.max(0, Math.round(durationMs)),
      projectId: auroraDeployment.bundle.projectId,
      bundleFingerprint: auroraDeployment.bundle.projectFingerprint,
      sdkVersion: auroraDeployment.sdk.version,
    }),
  );
}
