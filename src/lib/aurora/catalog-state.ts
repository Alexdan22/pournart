import type { AuroraEvaluationView, AuroraCatalogState } from "./types";

export function summarizeAuroraEvaluation(value: AuroraEvaluationView | undefined): AuroraCatalogState {
  if (!value) return "not-evaluated";
  if (value.state === "no-binding") return "unbound";
  if (value.state !== "success") return "invalid";
  const domain = record(record(value.response).domain);
  const projection = record(domain.decisionProjection);
  const decisions = array(projection.decisions).map(record);
  if (decisions.some((decision) => record(decision.outcome).status === "needs-review")) return "needs-review";
  if (decisions.some((decision) => array(decision.constraints).length > 0)) return "blocking";
  return "success";
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
