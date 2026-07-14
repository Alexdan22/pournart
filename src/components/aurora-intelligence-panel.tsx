"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import type { AuroraEvaluationView } from "@/lib/aurora/types";

type PanelState = AuroraEvaluationView | { state: "not-evaluated"; message: string } | { state: "authorization-failure"; message: string };

export function AuroraIntelligencePanel({ productId, initialState }: { productId: string; initialState: PanelState }) {
  const [state, setState] = useState<PanelState>(initialState);
  const [pending, startTransition] = useTransition();

  function evaluate() {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/aurora/products/${encodeURIComponent(productId)}/evaluate`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requestKey: crypto.randomUUID(),
            mode: state.state === "success" ? "re-evaluate" : "reuse-current",
          }),
        });
        const body = (await response.json()) as { result?: AuroraEvaluationView; error?: string };
        if (response.status === 401 || response.status === 403 || response.status === 404 && !body.result) {
          setState({ state: "authorization-failure", message: body.error ?? "Aurora pilot access is unavailable." });
          return;
        }
        if (!body.result) throw new Error(body.error ?? "Aurora did not return an evaluation.");
        setState(body.result);
      } catch {
        setState({ state: "runtime-failure", productId, message: "Aurora could not be reached. Retry when the service is available.", health: unavailableHealth });
      }
    });
  }

  const canEvaluate = ![
    "no-binding",
    "awaiting-review",
    "stale-binding",
    "invalid-binding",
    "missing-product-dna",
    "missing-ruleset",
    "missing-product",
    "authorization-failure",
    "unsupported-product",
  ].includes(state.state);

  return (
    <section className="admin-panel aurora-panel" aria-labelledby="aurora-intelligence-title" aria-busy={pending}>
      <header className="aurora-panel-heading">
        <div>
          <span className="aurora-eyebrow"><Sparkles aria-hidden size={15} /> Aurora Intelligence</span>
          <h2 id="aurora-intelligence-title">Product decision</h2>
        </div>
        {canEvaluate ? (
          <button className="admin-button primary" type="button" onClick={evaluate} disabled={pending}>
            <RefreshCw aria-hidden size={15} className={pending ? "spin" : ""} />
            {pending ? "Evaluating…" : state.state === "success" ? "Refresh" : "Execute"}
          </button>
        ) : null}
      </header>
      <div aria-live="polite">
        {pending ? <PanelMessage tone="loading" title="Executing approved intelligence" message="Aurora is evaluating the current catalog record." /> : null}
        {!pending ? <PanelContent state={state} /> : null}
      </div>
    </section>
  );
}

function PanelContent({ state }: { state: PanelState }) {
  if (state.state === "success") return <SuccessView value={state} />;
  const messages: Record<Exclude<PanelState["state"], "success">, { title: string; tone: MessageTone }> = {
    "not-evaluated": { title: "Ready to evaluate", tone: "neutral" },
    "no-binding": { title: "No ProductDNA binding", tone: "neutral" },
    "awaiting-review": { title: "Binding awaits review", tone: "neutral" },
    "stale-binding": { title: "Binding is stale", tone: "warning" },
    "invalid-binding": { title: "Binding manifest is invalid", tone: "warning" },
    "missing-product-dna": { title: "ProductDNA is missing", tone: "warning" },
    "missing-ruleset": { title: "RuleSet is missing", tone: "warning" },
    "missing-product": { title: "Product is missing", tone: "warning" },
    "unsupported-product": { title: "Intelligence is not supplied", tone: "neutral" },
    "validation-failure": { title: "Intelligence validation failed", tone: "warning" },
    "runtime-failure": { title: "Aurora is unavailable", tone: "warning" },
    "persistence-failure": { title: "Evaluation was not stored", tone: "warning" },
    "idempotency-conflict": { title: "Request conflict", tone: "warning" },
    "authorization-failure": { title: "Pilot access denied", tone: "warning" },
  };
  const display = messages[state.state];
  return <PanelMessage title={display.title} tone={display.tone} message={state.message} />;
}

function SuccessView({ value }: { value: Extract<AuroraEvaluationView, { state: "success" }> }) {
  const payload = record(value.response);
  const domain = record(payload.domain);
  const projection = record(domain.decisionProjection);
  const decisions = array(projection.decisions).map(record);
  const trace = record(payload.trace);
  const outcomeStatus = decisions.some((decision) => record(decision.outcome).status === "needs-review") ? "needs-review" : "accepted";
  return (
    <div className="aurora-success">
      <div className={`aurora-outcome ${outcomeStatus}`}>
        {outcomeStatus === "accepted" ? <CheckCircle2 aria-hidden /> : <ShieldAlert aria-hidden />}
        <div>
          <span>Decision outcome</span>
          <strong>{outcomeStatus === "accepted" ? "Accepted" : "Needs review"}</strong>
          <p>{decisions.length} deterministic Decision{decisions.length === 1 ? "" : "s"} for this product.</p>
        </div>
      </div>
      {decisions.length === 0 ? <PanelMessage title="No matching Decisions" tone="neutral" message="The approved RuleSet found no matching rules for the supplied context." /> : null}
      <div className="aurora-decision-list">
        {decisions.map((decision, index) => <DecisionCard decision={decision} key={String(record(decision.id).value ?? index)} />)}
      </div>
      <details className="aurora-advanced">
        <summary><ChevronRight aria-hidden size={15} /> Advanced details</summary>
        <dl>
          <Detail label="Binding" value={value.binding.bindingId} />
          <Detail label="Binding fingerprint" value={value.binding.entryFingerprint} />
          <Detail label="ProductDNA" value={value.binding.productDnaProductId} />
          <Detail label="Product artifact" value={value.binding.productDnaArtifactId} />
          <Detail label="RuleSet" value={value.binding.ruleSetDomainId} />
          <Detail label="Project" value={value.health.projectId} />
          <Detail label="Bundle fingerprint" value={String(record(trace.projectFingerprint).value ?? value.health.projectFingerprint ?? "Unavailable")} />
          <Detail label="Input fingerprint" value={String(record(trace.inputFingerprint).value ?? "Unavailable")} />
          <Detail label="Output fingerprint" value={String(record(trace.outputFingerprint).value ?? "Unavailable")} />
        </dl>
      </details>
      {value.evaluationId ? (
        <Link className="admin-button ghost" href={`/admin/intelligence/evaluations/${value.evaluationId}`}>
          Open durable evaluation and review
        </Link>
      ) : null}
    </div>
  );
}

function DecisionCard({ decision }: { decision: Record<string, unknown> }) {
  const outcome = record(decision.outcome);
  const recommendations = array(decision.recommendations).map(record);
  const constraints = array(decision.constraints).map(record);
  const findings = array(decision.findings).map(record);
  const conflicts = array(decision.conflicts).map(record);
  const explanations = array(decision.explanations).map(record);
  const evidence = array(decision.evidence).map(record);
  return (
    <article className="aurora-decision-card">
      <span className="aurora-decision-category">{String(outcome.category ?? "Decision")}</span>
      <h3>{String(outcome.summary ?? "Aurora Decision")}</h3>
      {recommendations.map((item, index) => <DecisionLine key={`r-${index}`} label={item.status === "rejected" ? "Rejected recommendation" : "Recommendation"} value={String(item.explanation ?? "")} />)}
      {constraints.map((item, index) => <DecisionLine key={`c-${index}`} label="Blocking constraint" value={String(item.explanation ?? "")} warning />)}
      {findings.map((item, index) => <DecisionLine key={`f-${index}`} label="Finding" value={String(item.statement ?? "")} />)}
      {conflicts.map((item, index) => <DecisionLine key={`x-${index}`} label="Needs-review conflict" value={String(item.explanation ?? "")} warning />)}
      {explanations.length ? <p className="aurora-explanation"><strong>Explanation:</strong> {String(explanations[0]?.text ?? "")}</p> : null}
      <details>
        <summary><ChevronRight aria-hidden size={14} /> Rule evidence and provenance</summary>
        {evidence.length ? (
          <ul className="aurora-evidence-list">
            {evidence.map((item, index) => (
              <li key={index}><strong>{String(item.kind ?? "evidence")}</strong>: {String(item.explanation ?? item.id ?? "Recorded")}{item.provenance ? <pre>{JSON.stringify(item.provenance, null, 2)}</pre> : null}</li>
            ))}
          </ul>
        ) : <p>No supporting evidence was returned.</p>}
      </details>
    </article>
  );
}

type MessageTone = "neutral" | "warning" | "loading";
function PanelMessage({ title, message, tone }: { title: string; message: string; tone: MessageTone }) {
  return <div className={`aurora-message ${tone}`}>{tone === "warning" ? <AlertTriangle aria-hidden /> : <Sparkles aria-hidden />}<div><h3>{title}</h3><p>{message}</p></div></div>;
}
function DecisionLine({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`aurora-decision-line ${warning ? "warning" : ""}`}><strong>{label}</strong><span>{value}</span></div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <><dt>{label}</dt><dd>{value}</dd></>;
}
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
const unavailableHealth = { ok: false, sdkVersion: "unknown", sdkSourceCommit: "unknown", sdkSha256: "unknown", bundleSha256: "unknown", projectId: "unknown", issueCodes: ["NETWORK_FAILURE"] } as const;
