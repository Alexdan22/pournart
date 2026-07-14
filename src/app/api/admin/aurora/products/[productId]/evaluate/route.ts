import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { evaluateProductIntelligence } from "@/lib/aurora/adapter";
import { createRequestKey, parseRequestKey, type AuroraRequestMode } from "@/lib/aurora/identity";

const idSchema = z.string().trim().min(1).max(128);
const bodySchema = z
  .object({
    requestKey: z.string().optional(),
    mode: z.enum(["reuse-current", "re-evaluate", "retry"]).optional(),
  })
  .strict();

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const parsed = idSchema.safeParse((await context.params).productId);
  if (!parsed.success)
    return NextResponse.json({ ok: false, error: "Invalid product ID." }, { status: 400 });
  const rawBody = await request.json().catch(() => null);
  const parsedBody = rawBody === null ? { success: true as const, data: {} } : bodySchema.safeParse(rawBody);
  if (!parsedBody.success)
    return NextResponse.json({ ok: false, error: "Invalid evaluation request." }, { status: 400 });
  const requestKey = parsedBody.data.requestKey
    ? parseRequestKey(parsedBody.data.requestKey)
    : createRequestKey();
  if (!requestKey)
    return NextResponse.json({ ok: false, error: "Request key must be a canonical UUID v4 or v5." }, { status: 400 });
  const result = await evaluateProductIntelligence(parsed.data, {
    requestedById: access.session.id,
    requestKey,
    requestMode: requestMode(parsedBody.data.mode),
  });
  const status =
    result.state === "missing-product"
      ? 404
      : result.state === "idempotency-conflict"
        ? 409
        : result.state === "runtime-failure" || result.state === "persistence-failure"
          ? 503
          : 200;
  return NextResponse.json({ ok: result.state === "success", result }, { status });
}

function requestMode(value: "reuse-current" | "re-evaluate" | "retry" | undefined): AuroraRequestMode {
  if (value === "re-evaluate") return "REEVALUATE";
  if (value === "retry") return "RETRY";
  return "REUSE_CURRENT";
}
