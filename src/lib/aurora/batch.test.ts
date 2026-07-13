import { describe, expect, it } from "vitest";
import { mapWithConcurrency, validateBatchProductIds } from "./batch";

describe("Aurora batch evaluation", () => {
  it("rejects duplicate, invalid, empty, and oversized ID lists", () => {
    expect(validateBatchProductIds([]).ok).toBe(false);
    expect(validateBatchProductIds(["one", "one"])).toMatchObject({ ok: false, error: expect.stringContaining("Duplicate") });
    expect(validateBatchProductIds([""]).ok).toBe(false);
    expect(validateBatchProductIds(Array.from({ length: 26 }, (_, index) => `id-${index}`)).ok).toBe(false);
  });

  it("runs at most four workers, preserves input order, and keeps partial failures", async () => {
    const ids = Array.from({ length: 12 }, (_, index) => `product-${index}`);
    let active = 0;
    let maximum = 0;
    const results = await mapWithConcurrency(ids, 4, async (id, index) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2 + (index % 3)));
      active -= 1;
      return index === 5 ? { id, ok: false } : { id, ok: true };
    });
    expect(maximum).toBe(4);
    expect(results.map((item) => item.id)).toEqual(ids);
    expect(results[5]).toEqual({ id: "product-5", ok: false });
    expect(results.filter((item) => !item.ok)).toHaveLength(1);
  });
});
