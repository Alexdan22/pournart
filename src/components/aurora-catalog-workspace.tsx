"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Play, Search, Sparkles } from "lucide-react";
import type { AuroraEvaluationView, AuroraCatalogState } from "@/lib/aurora/types";

export type AuroraCatalogItem = Readonly<{
  id: string;
  name: string;
  slug: string;
  bound: boolean;
  productDnaPresent: boolean;
  ready: boolean;
  blockers: readonly string[];
  state: AuroraCatalogState;
}>;

const filters = ["all", "bound", "unbound", "ready", "blocking", "needs-review", "success", "invalid"] as const;

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
          (filter === "bound" && item.bound) ||
          (filter === "unbound" && !item.bound) ||
          (filter === "ready" && item.ready) ||
          item.state === filter;
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
      const collected: AuroraEvaluationView[] = [];
      for (let offset = 0; offset < ids.length; offset += 4) {
        const chunk = ids.slice(offset, offset + 4);
        try {
          const response = await fetch("/api/admin/aurora/catalog/evaluate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ productIds: chunk }),
          });
          const body = (await response.json()) as { results?: AuroraEvaluationView[] };
          collected.push(...(body.results ?? chunk.map((productId) => clientFailure(productId))));
        } catch {
          collected.push(...chunk.map((productId) => clientFailure(productId)));
        }
        setProgress({ complete: Math.min(offset + chunk.length, ids.length), total: ids.length });
      }
      const byId = new Map(collected.map((result) => [result.productId, stateFor(result)]));
      setItems((current) => current.map((item) => (byId.has(item.id) ? { ...item, state: byId.get(item.id)! } : item)));
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
          <thead><tr><th>Select</th><th>Product</th><th>Binding</th><th>ProductDNA</th><th>Readiness</th><th>Aurora state</th><th>Open</th></tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.id}>
                <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} disabled={!selected.has(item.id) && selected.size >= 25} aria-label={`Select ${item.name}`} /></td>
                <td><strong>{item.name}</strong><small>{item.slug}</small></td>
                <td><Status value={item.bound ? "Bound" : "Unbound"} good={item.bound} /></td>
                <td><Status value={item.productDnaPresent ? "Present" : "Missing"} good={item.productDnaPresent} /></td>
                <td>{item.ready ? "Ready" : item.blockers.join(", ") || "Not ready"}</td>
                <td><span className={`aurora-state ${item.state}`}>{label(item.state)}</span></td>
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
