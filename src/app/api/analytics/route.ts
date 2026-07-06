import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const analyticsSchema = z.object({
  event: z.enum(["PRODUCT_VIEWED", "ADD_TO_CART", "CHECKOUT_STARTED", "ORDER_CREATED", "ORDER_PAID"]),
  sessionId: z.string().min(8).max(120).optional(),
  productId: z.string().optional(),
  orderId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyticsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await getSession();

  await prisma.analyticsEvent.create({
    data: {
      event: parsed.data.event,
      sessionId: parsed.data.sessionId,
      userId: session?.id,
      productId: parsed.data.productId || null,
      orderId: parsed.data.orderId || null,
      metadata: JSON.stringify(parsed.data.metadata || {}),
    },
  });

  return NextResponse.json({ ok: true });
}
