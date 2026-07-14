import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { AuroraCatalogWorkspace } from "./aurora-catalog-workspace";

const items = [
  { id: "one", name: "Bound product", slug: "bound-product", binding: "active" as const, evaluation: "not-evaluated" as const, review: null, ready: true, readinessReasons: [], bindingId: "binding.one", manifestFingerprint: "manifest", productDnaArtifactId: "artifact.one", ruleSetArtifactId: "rules.one", state: "not-evaluated" as const },
  { id: "two", name: "Unbound product", slug: "unbound-product", binding: "unbound" as const, evaluation: "not-evaluated" as const, review: null, ready: false, readinessReasons: [{ code: "BINDING_NOT_FOUND", label: "No exact-slug binding" }], manifestFingerprint: "manifest", state: "unbound" as const },
];

describe("Aurora catalog workspace", () => {
  it("searches, filters, and selects products without ranking them", async () => {
    const user = userEvent.setup();
    render(<AuroraCatalogWorkspace initialItems={items} />);
    expect(screen.getByText("Bound product")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Aurora state filter"), "binding-unbound");
    expect(screen.queryByText("Bound product")).not.toBeInTheDocument();
    expect(screen.getByText("Unbound product")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Select Unbound product"));
    expect(screen.getByRole("button", { name: "Evaluate selected (1)" })).toBeEnabled();
  });

  it("has no serious or critical static accessibility violations", async () => {
    render(<AuroraCatalogWorkspace initialItems={items} />);
    const results = await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } });
    expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  });
});
