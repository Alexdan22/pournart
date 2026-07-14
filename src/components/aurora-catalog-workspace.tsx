"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Play, Search, Sparkles } from "lucide-react";
import type { AuroraEvaluationView, AuroraCatalogState } from "@/lib/aurora/types";
import type {
  BindingCoverageState,
  CoverageReadinessReason,
  EvaluationCoverageState,
  ReviewCoverageState,
} from "@/lib/aurora/coverage";

export type AuroraCatalogItem = Readonly<{
  id: string;
  name: string;
  slug: string;
  binding: BindingCoverageState;
  evaluation: EvaluationCoverageState;
  review: ReviewCoverageState | null;
  ready: boolean;
  readinessReasons: readonly CoverageReadinessReason[];
  bindingId?: string;
  bindingFingerprint?: string;
  manifestFingerprint: string;
  productDnaArtifactId?: string;
  ruleSetArtifactId?: string;
  state: AuroraCatalogState;
}>;

const filters = [
  "all",
  "binding-active",
  "binding-unbound",
  "binding-awaiting-review",
  "binding-stale",
  "binding-invalid",
  "evaluation-current",
  "evaluation-stale",
  "evaluation-failed",
  "ready",
  "blocking",
] as const;

export function AuroraCatalogWorkspace({ initialItems }: { initialItems: readonly AuroraCatalogItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [progress, setProgress] = useState({ complete: 0, total: 0 });
  const [pending, startTransition] = useTransition();
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const matchesQuery = `${item.name} ${item.slug}`.toLowerCase().includes(query.trim().toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter.startsWith("binding-") && item.binding === filter.slice("binding-".length)) ||
          (filter.startsWith("evaluation-") && item.evaluation === filter.slice("evaluation-".length)) ||
          (filter === "ready" && item.ready) ||
          (filter === "blocking" && !item.ready);
        return matchesQuery && matchesFilter;
      }),
    [items, query, filter],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 25) next.add(id);
      return next;
    });
  }

  function evaluateSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    setProgress({ complete: 0, total: ids.length });
    startTransition(async () => {
      let collected: AuroraEvaluationView[];
      try {
        const response = await fetch("/api/admin/aurora/catalog/evaluate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            batchRequestKey: crypto.randomUUID(),
            productIds: ids,
            mode: "reuse-current",
          }),
        });
        const body = (await response.json()) as { results?: AuroraEvaluationView[] };
        collected = body.results ?? ids.map((productId) => clientFailure(productId));
      } catch {
        collected = ids.map((productId) => clientFailure(productId));
      }
      setProgress({ complete: ids.length, total: ids.length });
      const byId = new Map(collected.map((result) => [result.productId, result]));
      setItems((current) => current.map((item) => {
        const result = byId.get(item.id);
        return result
          ? {
              ...item,
              state: stateFor(result),
              evaluation: result.state === "success" ? "current" : "failed",
              review: result.state === "success" ? "new" : item.review,
            }
          : item;
      }));
    });
  }

  return (
    <section className="admin-panel aurora-catalog" aria-busy={pending}>
      <div className="admin-filter-bar">
        <label><Search aria-hidden size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search intelligence catalog…" /></label>
        <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} aria-label="Aurora state filter">
          {filters.map((value) => <option value={value} key={value}>{label(value)}</option>)}
        </select>
        <button className="admin-button primary" type="button" disabled={pending || selected.size === 0} onClick={evaluateSelected}>
          <Play aria-hidden size={15} /> Evaluate selected ({selected.size})
        </button>
      </div>
      <p className="aurora-progress" aria-live="polite">
        {pending ? `Evaluated ${progress.complete} of ${progress.total} selected products…` : progress.total ? `Completed ${progress.complete} of ${progress.total}; individual failures remain visible.` : "Select up to 25 products. Evaluations run four at a time."}
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Select</th><th>Product</th><th>Binding</th><th>ProductDNA</th><th>Evaluation</th><th>Review</th><th>Readiness</th><th>Open</th></tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={!selected.has(item.id) && selected.size >= 25} aria-label={`Select ${item.name}`} /></td>
                <td><strong>{item.name}</strong><small>{item.slug}</small></td>
                <td><span className={`aurora-state ${item.binding === "active" ? "success" : "invalid"}`}>{label(item.binding)}</span><small>{item.bindingId ?? "No binding ID"}</small></td>
                <td><Status value={item.productDnaArtifactId ? "Present" : "Missing"} good={Boolean(item.productDnaArtifactId)} /></td>
                <td><span className={`aurora-state ${item.evaluation === "current" ? "success" : item.evaluation}`}>{label(item.evaluation)}</span></td>
                <td>{item.review ? label(item.review) : "Not evaluated"}</td>
                <td>{item.ready ? "Ready" : item.readinessReasons.map((reason) => reason.label).join(", ") || "Not ready"}</td>
                <td><Link className="icon-action" href={`/admin/products/${item.id}/intelligence`} aria-label={`Open Intelligence for ${item.name}`}><Sparkles aria-hidden size={15} /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Status({ value, good }: { value: string; good: boolean }) { return <span className={`aurora-state ${good ? "success" : "unbound"}`}>{value}</span>; }
function label(value: string) { return value.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "); }
function stateFor(value: AuroraEvaluationView): AuroraCatalogState {
  if (value.state !== "success") return value.state === "no-binding" ? "unbound" : "invalid";
  const domain = record(record(value.response).domain);
  const decisions = array(record(domain.decisionProjection).decisions).map(record);
  if (decisions.some((decision) => record(decision.outcome).status === "needs-review")) return "needs-review";
  if (decisions.some((decision) => array(decision.constraints).length)) return "blocking";
  return "success";
}
function clientFailure(productId: string): AuroraEvaluationView {
  return { state: "runtime-failure", productId, message: "Batch request failed.", health: { ok: false, sdkVersion: "unknown", sdkSourceCommit: "unknown", sdkSha256: "unknown", bundleSha256: "unknown", projectId: "unknown", issueCodes: ["BATCH_REQUEST_FAILED"] } };
}
function record(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
