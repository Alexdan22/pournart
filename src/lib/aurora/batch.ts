import { z } from "zod";

const productIdsSchema = z.array(z.string().trim().min(1).max(128)).min(1).max(25);

export function validateBatchProductIds(value: unknown) {
  const parsed = productIdsSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, error: "Provide between 1 and 25 valid product IDs." };
  if (new Set(parsed.data).size !== parsed.data.length)
    return { ok: false as const, error: "Duplicate product IDs are not allowed." };
  return { ok: true as const, productIds: Object.freeze(parsed.data) };
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<readonly R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Concurrency must be positive.");
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index]!, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return Object.freeze(results);
}
