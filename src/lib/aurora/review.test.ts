import { describe, expect, it } from "vitest";
import {
  isAuroraReviewTransitionAllowed,
  ReviewNoteValidationError,
  validateReviewNote,
  type AuroraReviewState,
} from "./review-contract";

describe("Aurora review transition contract", () => {
  it("implements the complete approved transition matrix", () => {
    const states: AuroraReviewState[] = ["NEW", "ACCEPTED", "NEEDS_CHANGES", "RESOLVED"];
    const allowed = new Set([
      "NEW->ACCEPTED",
      "NEW->NEEDS_CHANGES",
      "ACCEPTED->NEEDS_CHANGES",
      "NEEDS_CHANGES->RESOLVED",
      "NEEDS_CHANGES->ACCEPTED",
      "RESOLVED->NEEDS_CHANGES",
      "RESOLVED->ACCEPTED",
    ]);
    for (const current of states)
      for (const next of states)
        expect(isAuroraReviewTransitionAllowed(current, next)).toBe(
          allowed.has(`${current}->${next}`),
        );
  });
});

describe("Aurora review note guardrails", () => {
  it("requires a note for needs changes and normalizes line endings", () => {
    expect(() => validateReviewNote(undefined, "NEEDS_CHANGES")).toThrowError(
      expect.objectContaining({ code: "REVIEW_NOTE_REQUIRED" }),
    );
    expect(validateReviewNote("First\r\nSecond", "NEEDS_CHANGES")).toBe("First\nSecond");
  });

  it("rejects excessive length, controls, and obvious sensitive patterns", () => {
    const cases = [
      "x".repeat(2_001),
      "control\u0000character",
      "alex@example.com",
      "+91 98765 43210",
      "password: sample",
      "Bearer abcdefghijklmnop",
      "eyJabcdefgh.abcdefgh.abcdefgh",
      "sk_live_abcdefgh1234",
    ];
    for (const note of cases) {
      expect(() => validateReviewNote(note, "NEEDS_CHANGES")).toThrow(ReviewNoteValidationError);
    }
  });

  it("accepts ordinary operational review text without claiming complete protection", () => {
    expect(
      validateReviewNote(
        "Premium presentation needs a second human review before catalog rollout.",
        "NEEDS_CHANGES",
      ),
    ).toBe("Premium presentation needs a second human review before catalog rollout.");
  });

  it("keeps review notes out of logs and authorizes review APIs before parsing input", () => {
    const service = readFileSync(join(process.cwd(), "src/lib/aurora/review.ts"), "utf8");
    const route = readFileSync(
      join(
        process.cwd(),
        "src/app/api/admin/aurora/evaluations/[evaluationId]/review/route.ts",
      ),
      "utf8",
    );
    expect(service).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(route.indexOf("authorizeAuroraApi()")).toBeLessThan(route.indexOf("request.json()"));
  });
});
import { readFileSync } from "node:fs";
import { join } from "node:path";
