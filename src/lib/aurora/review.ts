import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { runSerializedAuroraWrite } from "./database";
import { parseRequestKey, stableJson, sha256 } from "./identity";
import { verifyStoredAuroraResult } from "./serialization";
import {
  isAuroraReviewTransitionAllowed,
  ReviewNoteValidationError,
  validateReviewNote as validateReviewNoteContract,
  type AuroraReviewState,
  type AuroraReviewTarget,
} from "./review-contract";

export type { AuroraReviewState, AuroraReviewTarget } from "./review-contract";

export type ReviewTransitionInput = Readonly<{
  evaluationId: string;
  target: AuroraReviewTarget;
  newState: AuroraReviewState;
  expectedVersion: number;
  requestKey: string;
  actorId: string;
  note?: string;
}>;

export async function transitionAuroraReview(input: ReviewTransitionInput) {
  const requestKey = parseRequestKey(input.requestKey);
  if (!requestKey) throw new AuroraReviewError("REVIEW_REQUEST_KEY_INVALID", 400);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0)
    throw new AuroraReviewError("REVIEW_VERSION_INVALID", 400);
  if (!isReviewState(input.newState)) throw new AuroraReviewError("REVIEW_STATE_INVALID", 400);
  const target = normalizeTarget(input.target);
  const requestIdentity = {
    evaluationId: input.evaluationId,
    targetKey: target.targetKey,
    decisionId: target.decisionId,
    newState: input.newState,
    expectedVersion: input.expectedVersion,
    actorId: input.actorId,
  };
  const requestIdentityJson = stableJson(requestIdentity);
  const requestIdentityFingerprint = sha256(requestIdentityJson);

  const existingEvent = await prisma.auroraReviewEvent.findUnique({
    where: { requestKey },
    include: { review: true },
  });
  if (existingEvent)
    return existingReviewEvent(existingEvent, requestIdentityFingerprint);

  const note = validateReviewNote(input.note, input.newState);
  const evaluation = await prisma.auroraEvaluation.findUnique({ where: { id: input.evaluationId } });
  if (!evaluation) throw new AuroraReviewError("EVALUATION_NOT_FOUND", 404);
  if (target.decisionId) validateDecisionTarget(evaluation.resultJson, evaluation.resultSha256, evaluation.resultBytes, target.decisionId);

  const event = await runSerializedAuroraWrite((client) =>
    client.$transaction(
      async (transaction) => {
        const racedEvent = await transaction.auroraReviewEvent.findUnique({
          where: { requestKey },
          include: { review: true },
        });
        if (racedEvent) {
          verifyEventIdentity(racedEvent, requestIdentityFingerprint);
          return racedEvent;
        }

        const current = await transaction.auroraEvaluationReview.findUnique({
          where: {
            evaluationId_targetKey: {
              evaluationId: input.evaluationId,
              targetKey: target.targetKey,
            },
          },
        });
        const previousState = (current?.state ?? "NEW") as AuroraReviewState;
        const currentVersion = current?.version ?? 0;
        if (currentVersion !== input.expectedVersion)
          throw new AuroraReviewError("REVIEW_VERSION_CONFLICT", 409);
        if (!isAuroraReviewTransitionAllowed(previousState, input.newState))
          throw new AuroraReviewError("REVIEW_TRANSITION_INVALID", 409);

        let reviewId: string;
        if (!current) {
          const created = await transaction.auroraEvaluationReview.create({
            data: {
              evaluationId: input.evaluationId,
              targetKey: target.targetKey,
              decisionId: target.decisionId,
              state: input.newState,
              version: 1,
            },
          });
          reviewId = created.id;
        } else {
          const updated = await transaction.auroraEvaluationReview.updateMany({
            where: { id: current.id, version: input.expectedVersion },
            data: { state: input.newState, version: { increment: 1 } },
          });
          if (updated.count !== 1) throw new AuroraReviewError("REVIEW_VERSION_CONFLICT", 409);
          reviewId = current.id;
        }

        return transaction.auroraReviewEvent.create({
          data: {
            requestKey,
            requestIdentityJson,
            requestIdentityFingerprint,
            reviewId,
            previousState,
            newState: input.newState,
            note,
            actorId: input.actorId,
            actorIdAtExecution: input.actorId,
          },
          include: { review: true },
        });
      },
      { isolationLevel: "Serializable", maxWait: 500, timeout: 1_500 },
    ),
  );
  return reviewEventDto(event);
}

export async function getAuroraEvaluationDetail(evaluationId: string) {
  const evaluation = await prisma.auroraEvaluation.findUnique({
    where: { id: evaluationId },
    include: {
      reviews: {
        orderBy: [{ targetKey: "asc" }],
        include: { events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
      },
    },
  });
  if (!evaluation) return undefined;
  const [previous, newer] = await Promise.all([
    prisma.auroraEvaluation.findFirst({
      where: {
        productIdAtExecution: evaluation.productIdAtExecution,
        createdAt: { lt: evaluation.createdAt },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: comparisonSelect,
    }),
    prisma.auroraEvaluation.findFirst({
      where: {
        productIdAtExecution: evaluation.productIdAtExecution,
        createdAt: { gt: evaluation.createdAt },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: comparisonSelect,
    }),
  ]);
  let result = null;
  let resultIntegrityIssue: string | undefined;
  if (evaluation.status === "SUCCEEDED" && evaluation.resultJson) {
    try {
      result = verifyStoredAuroraResult(
        evaluation.resultJson,
        evaluation.resultSha256,
        evaluation.resultBytes,
      );
    } catch {
      resultIntegrityIssue = "STORED_RESULT_CHECKSUM_MISMATCH";
    }
  }
  return Object.freeze({
    evaluation: {
      id: evaluation.id,
      productId: evaluation.productIdAtExecution,
      productSlug: evaluation.productSlug,
      productName: evaluation.productName,
      bindingId: evaluation.bindingId,
      bindingFingerprint: evaluation.bindingFingerprint,
      manifestFingerprint: evaluation.bindingManifestFingerprint,
      projectId: evaluation.projectId,
      bundleSha256: evaluation.bundleSha256,
      bundleFingerprint: evaluation.bundleFingerprint,
      sdkVersion: evaluation.sdkVersion,
      productDnaArtifactId: evaluation.productDnaArtifactId,
      productDnaProductId: evaluation.productDnaProductId,
      ruleSetArtifactId: evaluation.ruleSetArtifactId,
      ruleSetDomainId: evaluation.ruleSetDomainId,
      applicationContextFingerprint: evaluation.applicationContextFingerprint,
      inputFingerprint: evaluation.auroraInputFingerprint,
      outputFingerprint: evaluation.auroraOutputFingerprint,
      resultSha256: evaluation.resultSha256,
      resultBytes: evaluation.resultBytes,
      status: evaluation.status,
      failureStage: evaluation.failureStage,
      issueCodes: [
        ...safeIssueCodes(evaluation.issueCodesJson),
        ...(resultIntegrityIssue ? [resultIntegrityIssue] : []),
      ],
      requestMode: evaluation.requestMode,
      trigger: evaluation.trigger,
      createdAt: evaluation.createdAt.toISOString(),
      result,
    },
    evaluationReview:
      reviewDto(evaluation.reviews.find((review) => review.targetKey === "evaluation")) ??
      defaultReview("evaluation"),
    decisionReviews: evaluation.reviews
      .filter((review) => review.targetKey !== "evaluation")
      .flatMap((review) => {
        const value = reviewDto(review);
        return value ? [value] : [];
      }),
    decisions: decisionSummaries(result),
    previous: comparisonDto(previous),
    newer: comparisonDto(newer),
  });
}

export type AuroraEvaluationDetail = NonNullable<
  Awaited<ReturnType<typeof getAuroraEvaluationDetail>>
>;

export function validateReviewNote(value: string | undefined, newState: AuroraReviewState) {
  try {
    return validateReviewNoteContract(value, newState);
  } catch (error) {
    if (error instanceof ReviewNoteValidationError)
      throw new AuroraReviewError(error.code, 400);
    throw error;
  }
}

export class AuroraReviewError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "AuroraReviewError";
  }
}

function normalizeTarget(target: AuroraReviewTarget) {
  if (target.scope === "evaluation")
    return { targetKey: "evaluation", decisionId: null };
  const decisionId = target.decisionId.trim();
  if (!decisionId || decisionId.length > 240 || /[\u0000-\u001f\u007f-\u009f]/.test(decisionId))
    throw new AuroraReviewError("REVIEW_DECISION_ID_INVALID", 400);
  return { targetKey: `decision:${decisionId}`, decisionId };
}

function validateDecisionTarget(
  resultJson: string | null,
  resultSha256: string | null,
  resultBytes: number | null,
  decisionId: string,
) {
  if (!resultJson) throw new AuroraReviewError("REVIEW_DECISION_NOT_FOUND", 404);
  let result;
  try {
    result = verifyStoredAuroraResult(resultJson, resultSha256, resultBytes);
  } catch {
    throw new AuroraReviewError("REVIEW_RESULT_INVALID", 409);
  }
  const decisionIds = decisionSummaries(result).map((decision) => decision.id);
  if (!decisionIds.includes(decisionId))
    throw new AuroraReviewError("REVIEW_DECISION_NOT_FOUND", 404);
}

function decisionSummaries(result: unknown) {
  const domain = record(record(result).domain);
  const projection = record(domain.decisionProjection);
  return array(projection.decisions)
    .map(record)
    .flatMap((decision) => {
      const id = record(decision.id).value;
      if (typeof id !== "string" || !id) return [];
      const outcome = record(decision.outcome);
      return [{ id, category: String(outcome.category ?? "Decision"), summary: String(outcome.summary ?? id) }];
    });
}

function reviewDto(review: ReviewWithEvents | undefined) {
  if (!review) return undefined;
  return {
    id: review.id,
    targetKey: review.targetKey,
    decisionId: review.decisionId,
    state: review.state as AuroraReviewState,
    version: review.version,
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    events: review.events.map((event) => ({
      id: event.id,
      requestKey: event.requestKey,
      previousState: event.previousState as AuroraReviewState,
      newState: event.newState as AuroraReviewState,
      note: event.note,
      actorId: event.actorIdAtExecution,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function defaultReview(targetKey: string) {
  return { id: null, targetKey, decisionId: null, state: "NEW" as const, version: 0, createdAt: null, updatedAt: null, events: [] };
}

function existingReviewEvent(
  event: EventWithReview,
  expectedIdentityFingerprint: string,
) {
  verifyEventIdentity(event, expectedIdentityFingerprint);
  return reviewEventDto(event);
}

function verifyEventIdentity(event: EventWithReview, expectedIdentityFingerprint: string) {
  if (event.requestIdentityFingerprint !== expectedIdentityFingerprint)
    throw new AuroraReviewError("IDEMPOTENCY_CONFLICT", 409);
}

function reviewEventDto(event: EventWithReview) {
  return {
    event: {
      id: event.id,
      requestKey: event.requestKey,
      previousState: event.previousState as AuroraReviewState,
      newState: event.newState as AuroraReviewState,
      note: event.note,
      actorId: event.actorIdAtExecution,
      createdAt: event.createdAt.toISOString(),
    },
    review: {
      id: event.review.id,
      targetKey: event.review.targetKey,
      decisionId: event.review.decisionId,
      state: event.review.state as AuroraReviewState,
      version: event.review.version,
      updatedAt: event.review.updatedAt.toISOString(),
    },
  };
}

function isReviewState(value: string): value is AuroraReviewState {
  return ["NEW", "ACCEPTED", "NEEDS_CHANGES", "RESOLVED"].includes(value);
}

function safeIssueCodes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 64) : [];
  } catch {
    return ["ISSUE_CODES_INVALID"];
  }
}

function comparisonDto(value: ComparisonEvaluation | null) {
  return value
    ? {
        id: value.id,
        status: value.status,
        requestMode: value.requestMode,
        createdAt: value.createdAt.toISOString(),
        applicationContextFingerprint: value.applicationContextFingerprint,
        outputFingerprint: value.auroraOutputFingerprint,
      }
    : null;
}

const comparisonSelect = {
  id: true,
  status: true,
  requestMode: true,
  createdAt: true,
  applicationContextFingerprint: true,
  auroraOutputFingerprint: true,
} satisfies Prisma.AuroraEvaluationSelect;

type ComparisonEvaluation = Prisma.AuroraEvaluationGetPayload<{ select: typeof comparisonSelect }>;
type ReviewWithEvents = Prisma.AuroraEvaluationReviewGetPayload<{ include: { events: true } }>;
type EventWithReview = Prisma.AuroraReviewEventGetPayload<{ include: { review: true } }>;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
