import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseTrackingEvents } from "@/lib/tracking-events";
import { requireUser } from "@/lib/session";

export async function GET(
  _request: Request,
  props: { params: Promise<{ orderId: string }> },
) {
  const session = await requireUser();
  const { orderId } = await props.params;
  const order = await prisma.order.findFirst({
    where: {
      OR: [{ id: orderId }, { orderNumber: orderId }],
      ...(session.role === "ADMIN" ? {} : { userId: session.id }),
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    shipmentStatus: order.shipmentStatus,
    courierName: order.courierName,
    awbCode: order.awbCode || order.courierTrackingId,
    trackingUrl: order.trackingUrl || order.courierTrackingUrl,
    events: parseTrackingEvents(order.trackingEvents),
  });
}
