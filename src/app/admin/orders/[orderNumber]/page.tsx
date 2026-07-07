import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Ban,
  Mail,
  PackageCheck,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  Truck,
} from "lucide-react";
import {
  addInternalNoteAction,
  cancelOrderAction,
  refundOrderAction,
  resendOrderEmailAction,
  sendManualOrderEmailAction,
  updateOrderAction,
} from "@/app/actions/admin";
import { AdminShiprocketPanel } from "@/components/admin-shiprocket-panel";
import { CopyButton } from "@/components/copy-button";
import { ORDER_STATUSES, PAYMENT_STATUSES, adminOrderStatusLabel, paymentStatusLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

function parseJson(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, string>;
    return Object.entries(parsed).filter(([, entry]) => entry);
  } catch {
    return [];
  }
}

export default async function AdminOrderDetailPage(props: PageProps<"/admin/orders/[orderNumber]">) {
  const { orderNumber } = await props.params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      user: true,
      items: true,
      timeline: { orderBy: { createdAt: "desc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      emailQueue: { include: { logs: true }, orderBy: { createdAt: "desc" } },
      emailLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <section className="admin-route admin-order-detail">
      <div className="admin-page-heading">
        <div>
          <span>Order</span>
          <h1>{order.orderNumber}</h1>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-button" href={`/admin/orders/${order.orderNumber}/invoice`}>
            <Printer aria-hidden size={16} /> Print Invoice
          </Link>
          <Link className="admin-button" href={`/admin/orders/${order.orderNumber}/shipping-label`}>
            <Truck aria-hidden size={16} /> Shipping Label
          </Link>
          {order.awbCode || order.courierTrackingId ? <CopyButton value={order.awbCode || order.courierTrackingId || ""} label="Copy Tracking" /> : null}
        </div>
      </div>

      <div className="admin-detail-grid">
        <section className="admin-panel span-2">
          <div className="admin-panel-heading">
            <h2>Update Status</h2>
          </div>
          <form className="admin-form compact" action={updateOrderAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <div className="admin-form-grid">
              <label>
                <span>Order Status</span>
                <select name="status" defaultValue={order.status}>
                  {ORDER_STATUSES.map((status) => (
                    <option value={status} key={status}>{adminOrderStatusLabel[status]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Payment</span>
                <select name="paymentStatus" defaultValue={order.paymentStatus}>
                  {PAYMENT_STATUSES.map((status) => (
                    <option value={status} key={status}>{paymentStatusLabel[status]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Courier</span>
                <input name="courierName" defaultValue={order.courierName ?? ""} />
              </label>
              <label>
                <span>Tracking ID</span>
                <input name="courierTrackingId" defaultValue={order.courierTrackingId ?? ""} />
              </label>
              <label className="span-2">
                <span>Tracking URL</span>
                <input name="courierTrackingUrl" defaultValue={order.courierTrackingUrl ?? ""} />
              </label>
              <label className="span-2">
                <span>Customer update note</span>
                <textarea name="note" placeholder="Short note for the timeline and status email" />
              </label>
              <label className="span-2">
                <span>Internal note</span>
                <textarea name="internalNote" placeholder="Private studio note" />
              </label>
            </div>
            <button className="admin-button primary" type="submit">
              <PackageCheck aria-hidden size={16} /> Update Status
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Customer Details</h2>
          </div>
          <dl className="admin-definition-list">
            <dt>Name</dt><dd>{order.user.name}</dd>
            <dt>Email</dt><dd>{order.user.email}</dd>
            <dt>Phone</dt><dd>{order.deliveryPhone}</dd>
            <dt>Customer</dt><dd><Link href={`/admin/customers/${order.userId}`}>Open profile</Link></dd>
          </dl>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Shipping Address</h2>
          </div>
          <p className="admin-address">
            {order.deliveryName}<br />
            {order.deliveryLine1}{order.deliveryLine2 ? `, ${order.deliveryLine2}` : ""}<br />
            {order.deliveryCity}, {order.deliveryState} - {order.deliveryPincode}
          </p>
        </section>

        <section className="admin-panel span-2">
          <div className="admin-panel-heading">
            <h2>Products & Customization</h2>
          </div>
          <div className="admin-order-items">
            {order.items.map((item) => (
              <article key={item.id}>
                <Image src={item.productImageUrl} alt={item.productName} width={72} height={72} />
                <div>
                  <strong>{item.productName}</strong>
                  <span>{item.quantity} x {formatINR(item.unitPrice)} = {formatINR(item.unitPrice * item.quantity)}</span>
                  <dl>
                    {parseJson(item.customization).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Payment</h2>
          </div>
          <dl className="admin-definition-list">
            <dt>Subtotal</dt><dd>{formatINR(order.subtotal)}</dd>
            <dt>Shipping</dt><dd>{formatINR(order.shippingFee)}</dd>
            <dt>Discount</dt><dd>{formatINR(order.discount)}</dd>
            <dt>Total</dt><dd>{formatINR(order.total)}</dd>
            <dt>Status</dt><dd>{paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] ?? order.paymentStatus}</dd>
            <dt>Razorpay</dt><dd>{order.razorpayPaymentId || order.razorpayOrderId || "Not linked"}</dd>
          </dl>
          <form action={refundOrderAction} className="inline-action-form">
            <input type="hidden" name="orderId" value={order.id} />
            <input name="reason" placeholder="Refund reason" />
            <button className="admin-button danger" type="submit">
              <RotateCcw aria-hidden size={15} /> Refund
            </button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Courier</h2>
          </div>
          <dl className="admin-definition-list">
            <dt>Partner</dt><dd>{order.courierName || "Not set"}</dd>
            <dt>Tracking ID</dt><dd>{order.awbCode || order.courierTrackingId || "Not set"}</dd>
            <dt>Shiprocket</dt><dd>{order.shiprocketShipmentId || "Not created"}</dd>
            <dt>Shipped</dt><dd>{order.shippedAt?.toLocaleString("en-IN") || "Not shipped"}</dd>
            <dt>Delivered</dt><dd>{order.deliveredAt?.toLocaleString("en-IN") || "Not delivered"}</dd>
          </dl>
          <form action={cancelOrderAction} className="inline-action-form">
            <input type="hidden" name="orderId" value={order.id} />
            <input name="note" placeholder="Cancellation note" />
            <button className="admin-button danger" type="submit">
              <Ban aria-hidden size={15} /> Cancel
            </button>
          </form>
        </section>

        <AdminShiprocketPanel
          order={{
            id: order.id,
            paymentStatus: order.paymentStatus,
            shiprocketOrderId: order.shiprocketOrderId,
            shiprocketShipmentId: order.shiprocketShipmentId,
            awbCode: order.awbCode,
            courierCompanyId: order.courierCompanyId,
            courierName: order.courierName,
            shipmentStatus: order.shipmentStatus,
            trackingUrl: order.trackingUrl,
            courierTrackingUrl: order.courierTrackingUrl,
            pickupGenerated: order.pickupGenerated,
            shipmentError: order.shipmentError,
          }}
        />

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Timeline</h2>
          </div>
          <div className="admin-timeline">
            {order.timeline.map((entry) => (
              <article key={entry.id}>
                <time>{entry.createdAt.toLocaleString("en-IN")}</time>
                <strong>{entry.title}</strong>
                <p>{entry.note}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Internal Notes</h2>
          </div>
          <form className="admin-note-form" action={addInternalNoteAction}>
            <input type="hidden" name="targetType" value="Order" />
            <input type="hidden" name="targetId" value={order.id} />
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="returnPath" value={`/admin/orders/${order.orderNumber}`} />
            <textarea name="content" placeholder="Private note for the studio" required />
            <button className="admin-button" type="submit">Add Note</button>
          </form>
          <div className="admin-note-list">
            {order.internalNotes.map((note) => (
              <article key={note.id}>
                <strong>{note.author?.name || "Admin"}</strong>
                <time>{note.createdAt.toLocaleString("en-IN")}</time>
                <p>{note.content}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-panel span-2">
          <div className="admin-panel-heading">
            <h2>Email History</h2>
            <Link href={`/admin/email-queue?order=${order.id}`}>Open queue</Link>
          </div>
          <div className="admin-email-grid">
            <form className="admin-form compact" action={sendManualOrderEmailAction}>
              <h3>Send Manual Email</h3>
              <input type="hidden" name="orderId" value={order.id} />
              <label><span>Subject</span><input name="subject" required /></label>
              <label><span>Message</span><textarea name="message" required /></label>
              <button className="admin-button primary" type="submit">
                <Send aria-hidden size={15} /> Send Manual Email
              </button>
            </form>
            <form className="admin-form compact" action={resendOrderEmailAction}>
              <h3>Resend Event Email</h3>
              <input type="hidden" name="orderId" value={order.id} />
              <label>
                <span>Email</span>
                <select name="event" defaultValue="ORDER_PLACED">
                  <option value="ORDER_PLACED">Order Confirmation</option>
                  <option value="ORDER_PRODUCTION_STARTED">Production Update</option>
                  <option value="ORDER_READY_TO_SHIP">Ready to Ship</option>
                  <option value="ORDER_SHIPPED">Shipping Notification</option>
                  <option value="REVIEW_REQUEST">Review Request</option>
                </select>
              </label>
              <button className="admin-button" type="submit">
                <RefreshCw aria-hidden size={15} /> Queue Email
              </button>
            </form>
          </div>
          <div className="admin-queue-mini">
            {order.emailQueue.map((email) => (
              <article className="admin-email-history-card" key={email.id}>
                <Mail aria-hidden size={15} />
                <span>
                  <strong>{email.subject}</strong>
                  <small>{email.event} / {email.status} / {email.attempts}/{email.maxAttempts} attempts</small>
                  <small>Queued {email.createdAt.toLocaleString("en-IN")} / Scheduled {email.scheduledAt.toLocaleString("en-IN")}</small>
                  <small>{email.sentAt ? `Sent ${email.sentAt.toLocaleString("en-IN")}` : "Not sent yet"}</small>
                </span>
                <details className="admin-inline-details">
                  <summary>Payload & logs</summary>
                  {email.lastError ? <p className="admin-error-text">{email.lastError}</p> : null}
                  <pre>{email.payload}</pre>
                  {email.logs.map((log) => (
                    <p key={log.id}>
                      <strong>{log.status}</strong> {log.createdAt.toLocaleString("en-IN")} / {log.error || log.providerResponse || "ok"}
                    </p>
                  ))}
                  {email.logs.length === 0 ? <p>No provider logs yet.</p> : null}
                </details>
              </article>
            ))}
            {order.emailQueue.length === 0 ? <p>No email jobs for this order yet.</p> : null}
          </div>
          <div className="admin-provider-log-list">
            <h3>Provider log</h3>
            {order.emailLogs.map((log) => (
              <article key={log.id}>
                <strong>{log.subject}</strong>
                <small>{log.event} / {log.status} / {log.createdAt.toLocaleString("en-IN")}</small>
                <p>{log.error || log.providerResponse || "ok"}</p>
              </article>
            ))}
            {order.emailLogs.length === 0 ? <p>No provider log rows for this order yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
