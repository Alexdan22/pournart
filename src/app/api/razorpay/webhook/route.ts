import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent } from "@/lib/email";
import { verifyWebhookSignature } from "@/lib/razorpay";

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
      };
    };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as RazorpayWebhookEvent;
  const razorpayOrderId = event.payload?.payment?.entity?.order_id;
  const razorpayPaymentId = event.payload?.payment?.entity?.id;

  if (!razorpayOrderId) {
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findFirst({
    where: { razorpayOrderId },
  });

  if (!order) {
    return NextResponse.json({ ok: true });
  }

  if (event.event === "payment.captured" || event.event === "payment.authorized") {
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        status: "PAYMENT_CONFIRMED",
        razorpayPaymentId: razorpayPaymentId || order.razorpayPaymentId,
        timeline: {
          create: {
            status: "PAYMENT_CONFIRMED",
            title: "Payment Confirmed",
            note: `Razorpay webhook received: ${event.event}. Your custom gift is ready for design review.`,
            actor: "SYSTEM",
          },
        },
      },
    });

    await dispatchEmailEvent("PAYMENT_CONFIRMED", { orderId: updatedOrder.id });
  }

  if (event.event === "payment.failed") {
    const failedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "FAILED",
        timeline: {
          create: {
            status: order.status,
            title: "Payment failed",
            note: "Razorpay reported a failed payment attempt.",
            actor: "SYSTEM",
          },
        },
      },
    });

    await dispatchEmailEvent("PAYMENT_FAILED", { orderId: failedOrder.id });
  }

  return NextResponse.json({ ok: true });
}
