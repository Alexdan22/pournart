import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import { getAuroraEvaluationDetail } from "@/lib/aurora/review";

const idSchema = z.string().trim().min(1).max(128);

export async function GET(
  _request: Request,
  context: { params: Promise<{ evaluationId: string }> },
) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const parsed = idSchema.safeParse((await context.params).evaluationId);
  if (!parsed.success)
    return NextResponse.json({ ok: false, code: "EVALUATION_ID_INVALID" }, { status: 400 });
  const detail = await getAuroraEvaluationDetail(parsed.data);
  if (!detail)
    return NextResponse.json({ ok: false, code: "EVALUATION_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ ok: true, detail });
}
