import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { AuroraIntelligencePanel } from "./aurora-intelligence-panel";
import { auroraProductBindings } from "@/lib/aurora/bindings";

const health = {
  ok: true,
  sdkVersion: "1.0.0-pilot.1",
  sdkSourceCommit: "commit",
  sdkSha256: "sdk",
  bundleSha256: "bundle",
  projectId: "project.pna.catalog-intelligence-pilot",
  projectFingerprint: "project-fingerprint",
  issueCodes: [],
} as const;

describe("Aurora Intelligence panel", () => {
  it.each([
    ["not-evaluated", "Ready to evaluate"],
    ["no-binding", "No ProductDNA binding"],
    ["stale-binding", "Binding is stale"],
    ["missing-product", "Product is missing"],
    ["unsupported-product", "Intelligence is not supplied"],
    ["authorization-failure", "Pilot access denied"],
  ] as const)("renders the %s state", (state, title) => {
    render(
      <AuroraIntelligencePanel
        productId="product.db"
        initialState={{ state, message: "State details", ...(state === "missing-product" ? { productId: "product.db" } : {}) }}
      />,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  });

  it("renders validation and runtime failures", () => {
    render(
      <AuroraIntelligencePanel
        productId="product.db"
        initialState={{
          state: "validation-failure",
          message: "Invalid",
          productId: "product.db",
          binding: auroraProductBindings[0]!,
          response: { ok: false, stage: "request", issues: [], trace: {} },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Intelligence validation failed" })).toBeInTheDocument();
    cleanup();
    render(
      <AuroraIntelligencePanel
        productId="product.db"
        initialState={{ state: "runtime-failure", message: "Unavailable", productId: "product.db", health }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Aurora is unavailable" })).toBeInTheDocument();
  });

  it("renders outcome-first Decisions with expandable evidence and technical details", () => {
    render(<AuroraIntelligencePanel productId="product.db" initialState={successState()} />);
    expect(screen.getByText("Accepted", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Recommendation")).toBeInTheDocument();
    expect(screen.getByText("Blocking constraint")).toBeInTheDocument();
    expect(screen.getByText("Finding")).toBeInTheDocument();
    expect(screen.getByText("Needs-review conflict")).toBeInTheDocument();
    expect(screen.getByText("Rule evidence and provenance")).toBeInTheDocument();
    expect(screen.getByText("Advanced details")).toBeInTheDocument();
  });

  it("has no serious or critical accessibility violations in the successful state", async () => {
    render(<AuroraIntelligencePanel productId="product.db" initialState={successState()} />);
    const results = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
});

function successState() {
  return {
    state: "success" as const,
    productId: "product.db",
    slug: "ocean-bloom-coaster-set",
    productName: "Coaster",
    binding: auroraProductBindings[0]!,
    health,
    evaluatedAt: "2026-07-13T00:00:00.000Z",
    response: {
      ok: true as const,
      domain: {
        decisionProjection: {
          decisions: [
            {
              id: { value: "decision.one" },
              outcome: { status: "accepted", category: "presentation", summary: "Use approved presentation." },
              recommendations: [{ status: "accepted", explanation: "Use gift presentation." }],
              constraints: [{ explanation: "Include care guidance." }],
              findings: [{ statement: "Catalog information is complete." }],
              conflicts: [{ explanation: "Presentation needs review." }],
              explanations: [{ text: "The approved rule matched." }],
              evidence: [{ kind: "rule-definition", explanation: "Matched approved rule.", provenance: { sourceKind: "product", sourceId: "product.db" } }],
            },
          ],
        },
      },
      trace: {
        projectFingerprint: { value: "project-fingerprint" },
        inputFingerprint: { value: "input-fingerprint" },
        outputFingerprint: { value: "output-fingerprint" },
      },
    },
  };
}
