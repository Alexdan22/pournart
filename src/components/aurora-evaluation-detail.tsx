"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { CheckCircle2, History, ShieldAlert } from "lucide-react";
import type {
  AuroraEvaluationDetail,
} from "@/lib/aurora/review";
import {
  AURORA_REVIEW_TRANSITIONS,
  REVIEW_NOTE_WARNING,
  type AuroraReviewState,
  type AuroraReviewTarget,
} from "@/lib/aurora/review-contract";

type ReviewValue = Readonly<{
  id: string | null;
  targetKey: string;
  decisionId: string | null;
  state: AuroraReviewState;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
  events: readonly Readonly<{
    id: string;
    requestKey: string;
    previousState: AuroraReviewState;
    newState: AuroraReviewState;
    note: string | null;
    actorId: string;
    createdAt: string;
  }>[];
}>;

export function AuroraEvaluationDetailView({
  initialDetail,
}: {
  initialDetail: AuroraEvaluationDetail;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const evaluation = detail.evaluation;
  return (
    <div className="aurora-evaluation-detail">
      <section className="admin-panel" aria-labelledby="evaluation-outcome-title">
        <div className="admin-panel-heading">
          <div>
            <span>Immutable evaluation</span>
            <h2 id="evaluation-outcome-title">{evaluation.productName}</h2>
          </div>
          <span className={`aurora-state ${evaluation.status === "SUCCEEDED" ? "success" : "invalid"}`}>
            {evaluation.status}
          </span>
        </div>
        <p>{evaluation.productSlug}</p>
        <ReviewControl
          evaluationId={evaluation.id}
          target={{ scope: "evaluation" }}
          value={detail.evaluationReview}
          onUpdated={setDetail}
        />
      </section>

      <section className="admin-panel" aria-labelledby="evaluation-decisions-title">
        <div className="admin-panel-heading">
          <h2 id="evaluation-decisions-title">Decision review</h2>
          <span>{detail.decisions.length} Decisions</span>
        </div>
        {detail.decisions.length ? (
          <div className="aurora-decision-list">
            {detail.decisions.map((decision) => {
              const review =
                detail.decisionReviews.find((item) => item.decisionId === decision.id) ??
                defaultDecisionReview(decision.id);
              return (
                <article className="aurora-decision-card" key={decision.id}>
                  <span className="aurora-decision-category">{decision.category}</span>
                  <h3>{decision.summary}</h3>
                  <code>{decision.id}</code>
                  <ReviewControl
                    evaluationId={evaluation.id}
                    target={{ scope: "decision", decisionId: decision.id }}
                    value={review}
                    onUpdated={setDetail}
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <p>No Decision-level review target exists for this evaluation.</p>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="evaluation-result-title">
        <div className="admin-panel-heading">
          <h2 id="evaluation-result-title">Exact Aurora result</h2>
          <span>{evaluation.resultBytes ?? 0} bytes</span>
        </div>
        {evaluation.result ? (
          <details>
            <summary>Expand immutable JSON</summary>
            <pre className="aurora-json-output">{JSON.stringify(evaluation.result, null, 2)}</pre>
          </details>
        ) : (
          <p>Failure attempt: {evaluation.issueCodes.join(", ") || evaluation.failureStage || "No safe issue code"}</p>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="evaluation-provenance-title">
        <h2 id="evaluation-provenance-title">Identity and provenance</h2>
        <dl className="aurora-detail-grid">
          <Detail label="Evaluation" value={evaluation.id} />
          <Detail label="Binding" value={evaluation.bindingId} />
          <Detail label="Binding fingerprint" value={evaluation.bindingFingerprint} />
          <Detail label="Manifest fingerprint" value={evaluation.manifestFingerprint} />
          <Detail label="ProductDNA artifact" value={evaluation.productDnaArtifactId} />
          <Detail label="ProductDNA product" value={evaluation.productDnaProductId} />
          <Detail label="RuleSet artifact" value={evaluation.ruleSetArtifactId} />
          <Detail label="RuleSet domain" value={evaluation.ruleSetDomainId} />
          <Detail label="Project" value={evaluation.projectId} />
          <Detail label="SDK" value={evaluation.sdkVersion} />
          <Detail label="Bundle checksum" value={evaluation.bundleSha256} />
          <Detail label="Bundle fingerprint" value={evaluation.bundleFingerprint} />
          <Detail label="Context fingerprint" value={evaluation.applicationContextFingerprint} />
          <Detail label="Input fingerprint" value={evaluation.inputFingerprint ?? "Unavailable"} />
          <Detail label="Output fingerprint" value={evaluation.outputFingerprint ?? "Unavailable"} />
          <Detail label="Stored-result checksum" value={evaluation.resultSha256 ?? "Unavailable"} />
        </dl>
      </section>

      <nav className="admin-panel aurora-comparison" aria-label="Evaluation comparison">
        <h2>Adjacent evaluations</h2>
        <div>
          {detail.previous ? (
            <Link href={`/admin/intelligence/evaluations/${detail.previous.id}`}>
              Previous · {detail.previous.status} · {formatDate(detail.previous.createdAt)}
            </Link>
          ) : <span>No previous evaluation</span>}
          {detail.newer ? (
            <Link href={`/admin/intelligence/evaluations/${detail.newer.id}`}>
              Newer · {detail.newer.status} · {formatDate(detail.newer.createdAt)}
            </Link>
          ) : <span>No newer evaluation</span>}
        </div>
      </nav>
    </div>
  );
}

function ReviewControl({
  evaluationId,
  target,
  value,
  onUpdated,
}: {
  evaluationId: string;
  target: AuroraReviewTarget;
  value: ReviewValue;
  onUpdated: (value: AuroraEvaluationDetail) => void;
}) {
  const [selectedState, setSelectedState] = useState<AuroraReviewState>(
    AURORA_REVIEW_TRANSITIONS[value.state][0] ?? "ACCEPTED",
  );
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const transitions = AURORA_REVIEW_TRANSITIONS[value.state];

  function submit() {
    setMessage("");
    if (selectedState === "NEEDS_CHANGES" && !note.trim()) {
      setMessage("A note is required when marking a review as needs changes.");
      return;
    }
    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/admin/aurora/evaluations/${encodeURIComponent(evaluationId)}/review`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              requestKey: crypto.randomUUID(),
              target,
              newState: selectedState,
              expectedVersion: value.version,
              note: note || undefined,
            }),
          },
        );
        const body = (await response.json()) as { code?: string };
        if (!response.ok) {
          setMessage(reviewError(body.code));
          return;
        }
        const refreshed = await fetch(
          `/api/admin/aurora/evaluations/${encodeURIComponent(evaluationId)}`,
        );
        const refreshedBody = (await refreshed.json()) as {
          detail?: AuroraEvaluationDetail;
          code?: string;
        };
        if (!refreshed.ok || !refreshedBody.detail) {
          setMessage(reviewError(refreshedBody.code));
          return;
        }
        onUpdated(refreshedBody.detail);
        setNote("");
        setMessage("Review saved.");
      } catch {
        setMessage("Review could not be saved. No Aurora result was changed.");
      } finally {
        requestAnimationFrame(() => buttonRef.current?.focus());
      }
    });
  }

  return (
    <section className="aurora-review-control" aria-label={target.scope === "evaluation" ? "Evaluation review" : "Decision review"}>
      <div className="aurora-review-current">
        {value.state === "ACCEPTED" || value.state === "RESOLVED"
          ? <CheckCircle2 aria-hidden size={18} />
          : <ShieldAlert aria-hidden size={18} />}
        <strong>{label(value.state)}</strong>
        <span>Version {value.version}</span>
      </div>
      {transitions.length ? (
        <div className="aurora-review-form">
          <label>
            Review state
            <select
              value={selectedState}
              onChange={(event) => setSelectedState(event.target.value as AuroraReviewState)}
              disabled={pending}
            >
              {transitions.map((state) => <option value={state} key={state}>{label(state)}</option>)}
            </select>
          </label>
          <label>
            Review note
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={2_000}
              rows={3}
              disabled={pending}
              aria-describedby={`review-warning-${targetKey(target)}`}
            />
          </label>
          <p className="aurora-note-warning" id={`review-warning-${targetKey(target)}`}>
            {REVIEW_NOTE_WARNING} Pattern detection is a guardrail and cannot guarantee removal.
          </p>
          <button
            ref={buttonRef}
            className="admin-button primary"
            type="button"
            onClick={submit}
            disabled={pending}
          >
            {pending ? "Saving…" : "Save review"}
          </button>
        </div>
      ) : null}
      <p aria-live="polite" role={message && message !== "Review saved." ? "alert" : undefined}>{message}</p>
      <details className="aurora-review-history">
        <summary><History aria-hidden size={15} /> Review history ({value.events.length})</summary>
        {value.events.length ? (
          <ol>
            {value.events.map((event) => (
              <li key={event.id}>
                <strong>{label(event.previousState)} → {label(event.newState)}</strong>
                <span>{formatDate(event.createdAt)} · actor {event.actorId}</span>
                {event.note ? <p>{event.note}</p> : null}
              </li>
            ))}
          </ol>
        ) : <p>No review transition has been recorded.</p>}
      </details>
    </section>
  );
}

function defaultDecisionReview(decisionId: string): ReviewValue {
  return {
    id: null,
    targetKey: `decision:${decisionId}`,
    decisionId,
    state: "NEW",
    version: 0,
    createdAt: null,
    updatedAt: null,
    events: [],
  };
}

function Detail({ label: term, value }: { label: string; value: string }) {
  return <div><dt>{term}</dt><dd><code>{value}</code></dd></div>;
}

function targetKey(target: AuroraReviewTarget) {
  return target.scope === "evaluation" ? "evaluation" : encodeURIComponent(target.decisionId);
}

function reviewError(code?: string) {
  const messages: Record<string, string> = {
    REVIEW_NOTE_REQUIRED: "A note is required for needs changes.",
    REVIEW_NOTE_TOO_LONG: "The note exceeds 2,000 characters.",
    REVIEW_NOTE_CONTROL_CHARACTER: "The note contains a prohibited control character.",
    REVIEW_NOTE_SENSITIVE_PATTERN: "The note resembles customer contact information or a secret. Remove it and retry.",
    REVIEW_VERSION_CONFLICT: "This review changed in another session. Reload before retrying.",
    REVIEW_TRANSITION_INVALID: "That review transition is not allowed.",
    IDEMPOTENCY_CONFLICT: "This request key belongs to another review transition.",
  };
  return messages[code ?? ""] ?? "Review could not be saved.";
}

function label(value: string) {
  return value.toLowerCase().split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
