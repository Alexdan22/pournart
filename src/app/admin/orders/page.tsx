import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, Search } from "lucide-react";
import { adminOrderStatusLabel, paymentStatusLabel } from "@/lib/constants";
import { adminPageSize, pageCount, pagination, todayRange, type AdminTableSearchParams } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

function statusWhere(status?: string) {
  if (!status) {
    return {};
  }

  if (status === "today") {
    const today = todayRange();
    return { createdAt: { gte: today.start, lt: today.end } };
  }

  if (status === "pending") {
    return { status: { in: ["ORDER_RECEIVED", "PAYMENT_CONFIRMED", "DESIGN_REVIEW"] } };
  }

  return { status };
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const where = {
    ...statusWhere(params.status),
    paymentStatus: params.payment || undefined,
    OR: query
      ? [
          { orderNumber: { contains: query } },
          { deliveryPhone: { contains: query } },
          { user: { name: { contains: query } } },
          { user: { email: { contains: query } } },
        ]
      : undefined,
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { user: true, items: true },
      orderBy: { createdAt: params.sort === "amount" ? "desc" : "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);
  const pages = pageCount(total);

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Orders</span>
          <h1>Order operations</h1>
        </div>
      </div>

      <form className="admin-filter-bar">
        <label>
          <Search aria-hidden size={16} />
          <input name="q" defaultValue={query} placeholder="Order, customer, phone, email..." />
        </label>
        <select name="status" defaultValue={params.status || ""}>
          <option value="">All statuses</option>
          <option value="today">Today</option>
          <option value="pending">Pending</option>
          {Object.entries(adminOrderStatusLabel).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <select name="payment" defaultValue={params.payment || ""}>
          <option value="">All payments</option>
          {Object.entries(paymentStatusLabel).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
        <button className="admin-button" type="submit">Filter</button>
        <Link className="admin-button ghost" href="/admin/orders">Clear</Link>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer</th>
              <th>Products</th>
              <th>Payment Status</th>
              <th>Order Status</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><strong>{order.orderNumber}</strong></td>
                <td>
                  <span>{order.user.name}</span>
                  <small>{order.user.email}</small>
                </td>
                <td>{order.items.map((item) => `${item.productName} x${item.quantity}`).join(", ")}</td>
                <td><span className={`status-pill payment-${order.paymentStatus.toLowerCase()}`}>{paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] || order.paymentStatus}</span></td>
                <td><span className="status-pill">{adminOrderStatusLabel[order.status as keyof typeof adminOrderStatusLabel] || order.status}</span></td>
                <td>{formatINR(order.total)}</td>
                <td>{order.createdAt.toLocaleDateString("en-IN")}</td>
                <td>
                  <Link className="icon-action" href={`/admin/orders/${order.orderNumber}`} aria-label={`Open ${order.orderNumber}`}>
                    <Eye aria-hidden size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="admin-empty">No orders match this view.</p> : null}
      </div>

      <div className="admin-pagination">
        <Link className={page <= 1 ? "disabled" : ""} href={`/admin/orders?page=${Math.max(1, page - 1)}`}>
          <ArrowLeft aria-hidden size={15} /> Previous
        </Link>
        <span>Page {page} of {pages} / {total} orders / {adminPageSize} per page</span>
        <Link className={page >= pages ? "disabled" : ""} href={`/admin/orders?page=${Math.min(pages, page + 1)}`}>
          Next <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    </section>
  );
}
