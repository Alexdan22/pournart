import Image from "next/image";
import { notFound } from "next/navigation";
import { ExternalLink, PackageCheck, Truck } from "lucide-react";
import { ReviewForm } from "@/components/review-form";
import {
  customerJourneyStatuses,
  getOrderStatusLabel,
  normalizeOrderStatus,
  paymentStatusLabel,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { warmDisplayCopy } from "@/lib/product-positioning";
import { requireUser } from "@/lib/session";
import { parseTrackingEvents } from "@/lib/tracking-events";

function timelineEntryTitle(entry: { status: string; title: string }) {
  const normalizedStatus = normalizeOrderStatus(entry.status);

  if (!normalizedStatus) {
    return entry.title;
  }

  const genericTitles = new Set([
    entry.status.toLowerCase().replaceAll("_", " "),
    getOrderStatusLabel(entry.status).toLowerCase(),
    "order placed",
    "placed",
  ]);

  return genericTitles.has(entry.title.trim().toLowerCase()) ? getOrderStatusLabel(entry.status) : entry.title;
}

export default async function OrderDetailPage(props: PageProps<"/orders/[orderNumber]">) {
  const session = await requireUser();
  const { orderNumber } = await props.params;
  const order = await prisma.order.findFirst({
    where: { orderNumber },
    include: {
      items: true,
      timeline: { orderBy: { createdAt: "asc" } },
      user: true,
      reviews: true,
    },
  });

  if (!order || (session.role !== "ADMIN" && order.userId !== session.id)) {
    notFound();
  }

  const normalizedStatus = normalizeOrderStatus(order.status);
  const currentIndex = normalizedStatus
    ? (customerJourneyStatuses as readonly string[]).indexOf(normalizedStatus)
    : -1;
  const reviewByOrderItem = new Map(order.reviews.map((review) => [review.orderItemId, review]));
  const trackingEvents = parseTrackingEvents(order.trackingEvents);
  const awbCode = order.awbCode || order.courierTrackingId;
  const trackingUrl = order.trackingUrl || order.courierTrackingUrl;

  return (
    <section className="order-detail">
      <div className="section-heading">
        <span className="panel-label">Your Crafting Journey</span>
        <h1>{order.orderNumber}</h1>
        <p>
          {getOrderStatusLabel(order.status)} ·{" "}
          {paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] ?? order.paymentStatus}
        </p>
      </div>

      <div className="tracking-grid">
        <div className="timeline-panel">
          {customerJourneyStatuses.map((status, index) => (
            <div className={index <= currentIndex ? "track-step active" : "track-step"} key={status}>
              <PackageCheck aria-hidden size={18} />
              <span>{getOrderStatusLabel(status)}</span>
            </div>
          ))}
        </div>
        <aside className="delivery-panel">
          <h2>Delivery details</h2>
          <p>
            {order.deliveryName}<br />
            {order.deliveryLine1}
            {order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}
            <br />
            {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
          </p>
          <dl className="shipment-meta">
            <dt>Status</dt><dd>{order.shipmentStatus || "Preparing"}</dd>
            <dt>Courier</dt><dd>{order.courierName || "To be assigned"}</dd>
            <dt>AWB</dt><dd>{awbCode || "Pending"}</dd>
          </dl>
          {trackingUrl ? (
            <a className="secondary-button" href={trackingUrl} target="_blank" rel="noreferrer">
              View shipment details <ExternalLink aria-hidden size={16} />
            </a>
          ) : (
            <p className="summary-note">Shipment or pickup details appear when your custom gift reaches that step.</p>
          )}
          {trackingEvents.length > 0 ? (
            <div className="shipment-timeline">
              {trackingEvents.slice(0, 6).map((event, index) => (
                <article key={`${event.date || "scan"}-${index}`}>
                  <Truck aria-hidden size={15} />
                  <span>
                    <strong>{event.status || event.activity}</strong>
                    <small>{[event.activity, event.location, event.date].filter(Boolean).join(" / ")}</small>
                  </span>
                </article>
              ))}
            </div>
          ) : null}
        </aside>
      </div>

      <section className="order-items">
        <h2>Items</h2>
        {order.items.map((item) => {
          const displayName = warmDisplayCopy(item.productName);

          return (
            <article className="summary-item" key={item.id}>
              <Image src={item.productImageUrl} alt={displayName} width={96} height={96} />
              <div>
                <strong>{displayName}</strong>
                <span>
                {item.quantity} x {formatINR(item.unitPrice)}
              </span>
              <small>{item.customization !== "{}" ? item.customization : "Standard customization notes"}</small>
              {normalizedStatus === "DELIVERED" && item.productId ? (
                reviewByOrderItem.has(item.id) ? (
                  <small>Your review is {reviewByOrderItem.get(item.id)?.status.toLowerCase()}.</small>
                ) : (
                  <ReviewForm orderId={order.id} orderItemId={item.id} productId={item.productId} />
                )
              ) : null}
            </div>
          </article>
          );
        })}
      </section>

      <section className="timeline-log">
        <h2>Updates</h2>
        {order.timeline.map((entry) => (
          <article key={entry.id}>
            <time>{entry.createdAt.toLocaleString("en-IN")}</time>
            <strong>{timelineEntryTitle(entry)}</strong>
            <p>{entry.note}</p>
          </article>
        ))}
      </section>
    </section>
  );
}
