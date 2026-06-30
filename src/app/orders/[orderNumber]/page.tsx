import Image from "next/image";
import { notFound } from "next/navigation";
import { ExternalLink, PackageCheck } from "lucide-react";
import { ORDER_STATUSES, orderStatusLabel, paymentStatusLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";

export default async function OrderDetailPage(props: PageProps<"/orders/[orderNumber]">) {
  const session = await requireUser();
  const { orderNumber } = await props.params;
  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: {
      items: true,
      timeline: { orderBy: { createdAt: "asc" } },
      user: true,
    },
  });

  if (!order || (session.role !== "ADMIN" && order.userId !== session.id)) {
    notFound();
  }

  const currentIndex = ORDER_STATUSES.indexOf(order.status as (typeof ORDER_STATUSES)[number]);

  return (
    <section className="order-detail">
      <div className="section-heading">
        <span className="panel-label">Tracking</span>
        <h1>{order.orderNumber}</h1>
        <p>
          {orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status} ·{" "}
          {paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] ?? order.paymentStatus}
        </p>
      </div>

      <div className="tracking-grid">
        <div className="timeline-panel">
          {ORDER_STATUSES.filter((status) => status !== "CANCELLED").map((status, index) => (
            <div className={index <= currentIndex ? "track-step active" : "track-step"} key={status}>
              <PackageCheck aria-hidden size={18} />
              <span>{orderStatusLabel[status]}</span>
            </div>
          ))}
        </div>
        <aside className="delivery-panel">
          <h2>Delivery</h2>
          <p>
            {order.deliveryName}<br />
            {order.deliveryLine1}
            {order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}
            <br />
            {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
          </p>
          {order.courierTrackingUrl ? (
            <a className="secondary-button" href={order.courierTrackingUrl} target="_blank" rel="noreferrer">
              Courier tracking <ExternalLink aria-hidden size={16} />
            </a>
          ) : (
            <p className="summary-note">Courier tracking appears after dispatch.</p>
          )}
        </aside>
      </div>

      <section className="order-items">
        <h2>Items</h2>
        {order.items.map((item) => (
          <article className="summary-item" key={item.id}>
            <Image src={item.productImageUrl} alt={item.productName} width={96} height={96} />
            <div>
              <strong>{item.productName}</strong>
              <span>
                {item.quantity} x {formatINR(item.unitPrice)}
              </span>
              <small>{item.customization !== "{}" ? item.customization : "Standard customization notes"}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="timeline-log">
        <h2>Updates</h2>
        {order.timeline.map((entry) => (
          <article key={entry.id}>
            <time>{entry.createdAt.toLocaleString("en-IN")}</time>
            <strong>{entry.title}</strong>
            <p>{entry.note}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
