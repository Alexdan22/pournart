import type { AuroraEvaluationView } from "./types";

type IdempotencyGlobal = typeof globalThis & {
  __pnaAuroraEvaluationFlights?: Map<
    string,
    { identityFingerprint: string; promise: Promise<AuroraEvaluationView> }
  >;
  __pnaAuroraBatchFlights?: Map<string, { identityFingerprint: string; promise: Promise<unknown> }>;
};

const state = globalThis as IdempotencyGlobal;
const evaluationFlights =
  state.__pnaAuroraEvaluationFlights ??
  new Map<string, { identityFingerprint: string; promise: Promise<AuroraEvaluationView> }>();
const batchFlights =
  state.__pnaAuroraBatchFlights ??
  new Map<string, { identityFingerprint: string; promise: Promise<unknown> }>();
state.__pnaAuroraEvaluationFlights = evaluationFlights;
state.__pnaAuroraBatchFlights = batchFlights;

export async function withEvaluationSingleFlight(
  requestKey: string,
  identityFingerprint: string,
  operation: () => Promise<AuroraEvaluationView>,
) {
  const existing = evaluationFlights.get(requestKey);
  if (existing) {
    if (existing.identityFingerprint !== identityFingerprint) throw new AuroraIdempotencyConflictError();
    return existing.promise;
  }
  const running = operation().finally(() => evaluationFlights.delete(requestKey));
  evaluationFlights.set(requestKey, { identityFingerprint, promise: running });
  return running;
}

export async function withBatchSingleFlight<T>(
  batchRequestKey: string,
  identityFingerprint: string,
  operation: () => Promise<T>,
): Promise<T> {
  const existing = batchFlights.get(batchRequestKey) as
    | { identityFingerprint: string; promise: Promise<T> }
    | undefined;
  if (existing) {
    if (existing.identityFingerprint !== identityFingerprint) throw new AuroraIdempotencyConflictError();
    return existing.promise;
  }
  const running = operation().finally(() => batchFlights.delete(batchRequestKey));
  batchFlights.set(batchRequestKey, { identityFingerprint, promise: running });
  return running;
}

export class AuroraIdempotencyConflictError extends Error {
  readonly code = "IDEMPOTENCY_CONFLICT";
  constructor() {
    super("The request key is already associated with a different immutable request identity.");
    this.name = "AuroraIdempotencyConflictError";
  }
}
