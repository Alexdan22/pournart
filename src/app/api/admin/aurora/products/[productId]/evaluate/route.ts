import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { evaluateProductIntelligence } from "@/lib/aurora/adapter";

const idSchema = z.string().trim().min(1).max(128);

export async function POST(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const parsed = idSchema.safeParse((await context.params).productId);
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: "Invalid product ID." }, { status: 400 });
  const result = await evaluateProductIntelligence(parsed.data);
  const status = result.state === "missing-product" ? 404 : result.state === "runtime-failure" ? 503 : 200;
  return NextResponse.json({ ok: result.state === "success", result }, { status });
}
