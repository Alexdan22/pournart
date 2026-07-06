import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, Search } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { bulkOrderAction } from "@/app/actions/admin";
import { AdminSortLink } from "@/components/admin-sort-link";
import { ORDER_STATUSES, PAYMENT_STATUSES, adminOrderStatusLabel, paymentStatusLabel } from "@/lib/constants";
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

function sortDirection(value?: string): Prisma.SortOrder {
  return value === "asc" ? "asc" : "desc";
}

function orderSort(sort: string | undefined, direction: Prisma.SortOrder): Prisma.OrderOrderByWithRelationInput[] {
  if (sort === "order") {
    return [{ orderNumber: direction }];
  }

  if (sort === "customer") {
    return [{ user: { name: direction } }, { createdAt: "desc" }];
  }

  if (sort === "payment") {
    return [{ paymentStatus: direction }, { createdAt: "desc" }];
  }

  if (sort === "status") {
    return [{ status: direction }, { createdAt: "desc" }];
  }

  if (sort === "amount") {
    return [{ total: direction }, { createdAt: "desc" }];
  }

  return [{ createdAt: direction }];
}

function hrefWith(params: AdminTableSearchParams, overrides: Record<string, string | number>) {
  const next = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      next.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    next.set(key, String(value));
  }

  return `/admin/orders?${next.toString()}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<AdminTableSearchParams>;
}) {
  const params = await searchParams;
  const { page, take, skip } = pagination(params.page);
  const query = params.q?.trim();
  const direction = sortDirection(params.direction);
  const where: Prisma.OrderWhereInput = {
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
      orderBy: orderSort(params.sort, direction),
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

      <form className="admin-bulk-bar" id="bulk-orders" action={bulkOrderAction}>
        <select name="bulkAction" defaultValue="status:CRAFTING" aria-label="Bulk order action">
          <optgroup label="Order status">
            {ORDER_STATUSES.map((status) => (
              <option value={`status:${status}`} key={status}>Set {adminOrderStatusLabel[status]}</option>
            ))}
          </optgroup>
          <optgroup label="Payment">
            {PAYMENT_STATUSES.map((status) => (
              <option value={`payment:${status}`} key={status}>Mark {paymentStatusLabel[status]}</option>
            ))}
          </optgroup>
        </select>
        <button className="admin-button" type="submit">Apply to selected orders</button>
        <Link className="admin-button ghost" href="/admin/production">Open Production Board</Link>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th><span className="sr-only">Select</span></th>
              <th><AdminSortLink basePath="/admin/orders" label="Order Number" searchParams={params} sortKey="order" defaultSort="date" /></th>
              <th><AdminSortLink basePath="/admin/orders" label="Customer" searchParams={params} sortKey="customer" defaultSort="date" /></th>
              <th>Products</th>
              <th><AdminSortLink basePath="/admin/orders" label="Payment Status" searchParams={params} sortKey="payment" defaultSort="date" /></th>
              <th><AdminSortLink basePath="/admin/orders" label="Order Status" searchParams={params} sortKey="status" defaultSort="date" /></th>
              <th><AdminSortLink basePath="/admin/orders" label="Amount" searchParams={params} sortKey="amount" defaultSort="date" /></th>
              <th><AdminSortLink basePath="/admin/orders" label="Date" searchParams={params} sortKey="date" defaultSort="date" /></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td><input form="bulk-orders" type="checkbox" name="orderId" value={order.id} aria-label={`Select ${order.orderNumber}`} /></td>
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
        <Link className={page <= 1 ? "disabled" : ""} href={hrefWith(params, { page: Math.max(1, page - 1) })}>
          <ArrowLeft aria-hidden size={15} /> Previous
        </Link>
        <span>Page {page} of {pages} / {total} orders / {adminPageSize} per page</span>
        <Link className={page >= pages ? "disabled" : ""} href={hrefWith(params, { page: Math.min(pages, page + 1) })}>
          Next <ArrowRight aria-hidden size={15} />
        </Link>
      </div>
    </section>
  );
}
