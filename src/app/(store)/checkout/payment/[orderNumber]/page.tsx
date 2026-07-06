import { notFound } from "next/navigation";
import { PaymentClient } from "@/components/payment-client";
import { prisma } from "@/lib/db";
import { getPublicRazorpayKey } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";

export default async function PaymentPage(props: PageProps<"/checkout/payment/[orderNumber]">) {
  const session = await requireUser();
  const { orderNumber } = await props.params;
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.id },
    include: { user: true },
  });

  if (!order) {
    notFound();
  }

  return (
    <section className="payment-page">
      <PaymentClient
        orderNumber={order.orderNumber}
        amount={order.total}
        razorpayOrderId={order.razorpayOrderId}
        razorpayKey={getPublicRazorpayKey()}
        customer={{
          name: order.user.name,
          email: order.user.email,
          phone: order.user.phone,
        }}
      />
    </section>
  );
}
