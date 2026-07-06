import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { addInternalNoteAction, sendCustomerEmailAction } from "@/app/actions/admin";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

export default async function AdminCustomerProfilePage(props: PageProps<"/admin/customers/[id]">) {
  const { id } = await props.params;
  const customer = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: { include: { timeline: true }, orderBy: { createdAt: "desc" } },
      internalNotes: { include: { author: true }, orderBy: { createdAt: "desc" } },
      emailQueue: { orderBy: { createdAt: "desc" }, take: 20 },
      emailLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!customer) {
    notFound();
  }

  const paidOrders = customer.orders.filter((order) => order.paymentStatus === "PAID");
  const lifetimeSpend = paidOrders.reduce((total, order) => total + order.total, 0);
  const averageOrder = paidOrders.length ? lifetimeSpend / paidOrders.length : 0;
  const detailText = `${customer.name}\n${customer.email}\n${customer.phone || ""}`;

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Customer</span>
          <h1>{customer.name}</h1>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-button" href={`/admin/orders?q=${encodeURIComponent(customer.email)}`}>View Orders</Link>
          <CopyButton value={detailText} label="Copy Details" />
        </div>
      </div>
      <div className="admin-detail-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Summary</h2></div>
          <dl className="admin-definition-list">
            <dt>Email</dt><dd>{customer.email}</dd>
            <dt>Phone</dt><dd>{customer.phone || "Not set"}</dd>
            <dt>Orders</dt><dd>{customer.orders.length}</dd>
            <dt>Lifetime Spend</dt><dd>{formatINR(lifetimeSpend)}</dd>
            <dt>Average Order</dt><dd>{formatINR(averageOrder)}</dd>
          </dl>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Address</h2></div>
          {customer.addresses.map((address) => (
            <p className="admin-address" key={address.id}>
              <strong>{address.label}</strong><br />
              {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
              {address.city}, {address.state} - {address.pincode}
            </p>
          ))}
          {customer.addresses.length === 0 ? <p>No saved addresses.</p> : null}
        </section>
        <section className="admin-panel span-2">
          <div className="admin-panel-heading"><h2>Orders</h2></div>
          <div className="admin-compact-list">
            {customer.orders.map((order) => (
              <Link href={`/admin/orders/${order.orderNumber}`} key={order.id}>
                <span>
                  <strong>{order.orderNumber}</strong>
                  <small>{order.status} / {formatINR(order.total)} / {order.createdAt.toLocaleDateString("en-IN")}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Send Email</h2></div>
          <form className="admin-form compact" action={sendCustomerEmailAction}>
            <input type="hidden" name="userId" value={customer.id} />
            <label><span>Subject</span><input name="subject" required /></label>
            <label><span>Message</span><textarea name="message" required /></label>
            <button className="admin-button primary" type="submit">Send Email</button>
          </form>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><h2>Notes</h2></div>
          <form className="admin-note-form" action={addInternalNoteAction}>
            <input type="hidden" name="targetType" value="User" />
            <input type="hidden" name="targetId" value={customer.id} />
            <input type="hidden" name="userId" value={customer.id} />
            <input type="hidden" name="returnPath" value={`/admin/customers/${customer.id}`} />
            <textarea name="content" required />
            <button className="admin-button" type="submit">Add Note</button>
          </form>
          <div className="admin-note-list">
            {customer.internalNotes.map((note) => (
              <article key={note.id}><strong>{note.author?.name || "Admin"}</strong><time>{note.createdAt.toLocaleString("en-IN")}</time><p>{note.content}</p></article>
            ))}
          </div>
        </section>
        <section className="admin-panel span-2">
          <div className="admin-panel-heading"><h2>Email History</h2></div>
          <div className="admin-queue-mini">
            {customer.emailQueue.map((email) => (
              <article key={email.id}><span><strong>{email.subject}</strong><small>{email.event} / {email.status} / {email.createdAt.toLocaleString("en-IN")}</small></span></article>
            ))}
            {customer.emailQueue.length === 0 ? <p>No tracked emails yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
