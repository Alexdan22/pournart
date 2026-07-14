import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeAuroraApi } from "@/lib/aurora/api-access";
import {
  AuroraReviewError,
  transitionAuroraReview,
  type AuroraReviewTarget,
} from "@/lib/aurora/review";

const idSchema = z.string().trim().min(1).max(128);
const targetSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("evaluation") }).strict(),
  z.object({ scope: z.literal("decision"), decisionId: z.string().min(1).max(240) }).strict(),
]);
const bodySchema = z
  .object({
    requestKey: z.string(),
    target: targetSchema,
    newState: z.enum(["ACCEPTED", "NEEDS_CHANGES", "RESOLVED"]),
    expectedVersion: z.number().int().min(0),
    note: z.string().optional(),
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ evaluationId: string }> },
) {
  const access = await authorizeAuroraApi();
  if (!access.ok) return access.response;
  const evaluationId = idSchema.safeParse((await context.params).evaluationId);
  if (!evaluationId.success)
    return NextResponse.json({ ok: false, code: "EVALUATION_ID_INVALID" }, { status: 400 });
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ ok: false, code: "REVIEW_REQUEST_INVALID" }, { status: 400 });
  try {
    const result = await transitionAuroraReview({
      evaluationId: evaluationId.data,
      target: body.data.target as AuroraReviewTarget,
      newState: body.data.newState,
      expectedVersion: body.data.expectedVersion,
      requestKey: body.data.requestKey,
      actorId: access.session.id,
      note: body.data.note,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof AuroraReviewError)
      return NextResponse.json({ ok: false, code: error.code }, { status: error.status });
    return NextResponse.json(
      { ok: false, code: "AURORA_REVIEW_PERSISTENCE_FAILURE" },
      { status: 503 },
    );
  }
}
