import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent } from "@/lib/email";
import { getRazorpayClient, verifyCheckoutSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  const body = await request.json();
  const orderNumber = String(body.orderNumber || "");
  const razorpayOrderId = String(body.razorpay_order_id || "");
  const razorpayPaymentId = String(body.razorpay_payment_id || "");
  const razorpaySignature = String(body.razorpay_signature || "");

  if (!orderNumber || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json({ error: "Missing payment verification details." }, { status: 400 });
  }

  const validSignature = verifyCheckoutSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!validSignature) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      razorpayOrderId,
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const razorpay = getRazorpayClient();

  if (razorpay && process.env.RAZORPAY_CAPTURE_ON_VERIFY === "true") {
    await razorpay.payments.capture(razorpayPaymentId, order.total, "INR");
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      status: "PAYMENT_CONFIRMED",
      razorpayPaymentId,
      razorpaySignature,
      timeline: {
        create: {
          status: "PAYMENT_CONFIRMED",
          title: "Payment Confirmed",
          note: "Razorpay payment was verified successfully. Your custom gift is ready for design review.",
          actor: "SYSTEM",
        },
      },
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      event: "ORDER_PAID",
      userId: updatedOrder.userId,
      orderId: updatedOrder.id,
      metadata: JSON.stringify({ total: updatedOrder.total, source: "razorpay_verify" }),
    },
  });

  await dispatchEmailEvent("PAYMENT_CONFIRMED", { orderId: updatedOrder.id });

  return NextResponse.json({
    ok: true,
    redirectTo: `/orders/${updatedOrder.orderNumber}`,
  });
}
