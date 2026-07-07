import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function AdminShippingLabelPage(props: PageProps<"/admin/orders/[orderNumber]/shipping-label">) {
  const { orderNumber } = await props.params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });

  if (!order) {
    notFound();
  }

  return (
    <section className="print-document shipping-label">
      <header>
        <div>
          <strong>Pour n Art</strong>
          <span>{order.orderNumber}</span>
        </div>
      </header>
      <div className="shipping-label-box">
        <span>Ship To</span>
        <h1>{order.deliveryName}</h1>
        <p>
          {order.deliveryLine1}{order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}<br />
          {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}<br />
          Phone: {order.deliveryPhone}
        </p>
      </div>
      <div className="shipping-label-box">
        <span>Contents</span>
        <p>{order.items.map((item) => `${item.productName} x${item.quantity}`).join(", ")}</p>
      </div>
      <div className="shipping-label-box">
        <span>Courier</span>
        <p>{order.courierName || "To be assigned"}<br />{order.awbCode || order.courierTrackingId || "Tracking pending"}</p>
      </div>
    </section>
  );
}
