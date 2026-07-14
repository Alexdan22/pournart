import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import type { AuroraEvaluationDetail } from "@/lib/aurora/review";
import { AuroraEvaluationDetailView } from "./aurora-evaluation-detail";

const detail: AuroraEvaluationDetail = {
  evaluation: {
    id: "evaluation.one",
    productId: "product.one",
    productSlug: "product-one",
    productName: "Product one",
    bindingId: "binding.one",
    bindingFingerprint: "binding-fingerprint",
    manifestFingerprint: "manifest-fingerprint",
    projectId: "project.one",
    bundleSha256: "bundle-sha",
    bundleFingerprint: "bundle-fingerprint",
    sdkVersion: "1.0.0-pilot.1",
    productDnaArtifactId: "artifact.product",
    productDnaProductId: "product.dna",
    ruleSetArtifactId: "artifact.rules",
    ruleSetDomainId: "rules.domain",
    applicationContextFingerprint: "context",
    inputFingerprint: "input",
    outputFingerprint: "output",
    resultSha256: "result-sha",
    resultBytes: 100,
    status: "SUCCEEDED",
    failureStage: null,
    issueCodes: [],
    requestMode: "REEVALUATE",
    trigger: "test",
    createdAt: "2026-07-14T00:00:00.000Z",
    result: { ok: true, domain: {}, trace: {} },
  },
  evaluationReview: {
    id: "review.one",
    targetKey: "evaluation",
    decisionId: null,
    state: "NEW",
    version: 0,
    createdAt: "2026-07-14T00:00:00.000Z",
    updatedAt: "2026-07-14T00:00:00.000Z",
    events: [
      {
        id: "event.one",
        requestKey: "00000000-0000-4000-8000-000000000001",
        previousState: "NEW",
        newState: "NEEDS_CHANGES",
        note: "<img src=x onerror=alert(1)>",
        actorId: "admin.one",
        createdAt: "2026-07-14T00:01:00.000Z",
      },
    ],
  },
  decisionReviews: [],
  decisions: [],
  previous: null,
  newer: null,
};

describe("Aurora evaluation review UI", () => {
  it("shows the note warning, escapes note output, and provides accessible validation", async () => {
    const user = userEvent.setup();
    render(<AuroraEvaluationDetailView initialDetail={detail} />);
    expect(
      screen.getByText(/Do not enter customer information, passwords, tokens, credentials or secrets/),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Review state"), "NEEDS_CHANGES");
    await user.click(screen.getByRole("button", { name: "Save review" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A note is required");
  });

  it("has no serious or critical static accessibility violations", async () => {
    render(<AuroraEvaluationDetailView initialDetail={detail} />);
    const results = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? "")),
    ).toEqual([]);
  });
});
