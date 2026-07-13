import { NextResponse } from "next/server";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { evaluateProductIntelligence } from "@/lib/aurora/adapter";
import { mapWithConcurrency, validateBatchProductIds } from "@/lib/aurora/batch";

export async function POST(request: Request) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const body = (await request.json().catch(() => null)) as { productIds?: unknown } | null;
  const parsed = validateBatchProductIds(body?.productIds);
  if (!parsed.ok) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  const results = await mapWithConcurrency(parsed.productIds, 4, async (productId) => {
    try {
      return await evaluateProductIntelligence(productId);
    } catch {
      return { state: "runtime-failure" as const, productId, message: "Unexpected evaluation failure.", health: failureHealth };
    }
  });
  return NextResponse.json({ ok: results.every((item) => item.state === "success"), results });
}

const failureHealth = {
  ok: false,
  sdkVersion: "unknown",
  sdkSourceCommit: "unknown",
  sdkSha256: "unknown",
  bundleSha256: "unknown",
  projectId: "unknown",
  issueCodes: ["UNEXPECTED_BATCH_FAILURE"],
} as const;
