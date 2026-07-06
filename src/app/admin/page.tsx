import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  MailWarning,
  PackageCheck,
  ReceiptText,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { monthRange, reservedInventoryByProduct, todayRange } from "@/lib/admin-data";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

function statCard(title: string, value: string | number, href: string, tone = "neutral") {
  return (
    <Link className={`admin-metric-card tone-${tone}`} href={href}>
      <span>{title}</span>
      <strong>{value}</strong>
      <ArrowRight aria-hidden size={15} />
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const today = todayRange();
  const month = monthRange();
  const [
    todaysOrders,
    pendingOrders,
    craftingOrders,
    readyOrders,
    deliveredToday,
    revenueToday,
    revenueMonth,
    pendingPayments,
    failedEmails,
    recentCustomers,
    recentActivity,
    recentEnquiries,
    products,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today.start, lt: today.end } } }),
    prisma.order.count({ where: { status: { in: ["ORDER_RECEIVED", "PAYMENT_CONFIRMED", "DESIGN_REVIEW"] } } }),
    prisma.order.count({ where: { status: "CRAFTING" } }),
    prisma.order.count({ where: { status: { in: ["PACKED", "READY_FOR_PICKUP"] } } }),
    prisma.order.count({ where: { deliveredAt: { gte: today.start, lt: today.end } } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: today.start, lt: today.end } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: month.start, lt: month.end } },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { paymentStatus: { in: ["PENDING", "FAILED"] } } }),
    prisma.emailQueue.count({ where: { status: "FAILED" } }),
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.orderTimeline.findMany({
      include: { order: { select: { orderNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.contactEnquiry.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.product.findMany({
      where: { adminStatus: { not: "ARCHIVED" } },
      include: { category: true },
      orderBy: { inventory: "asc" },
      take: 80,
    }),
  ]);
  const reserved = await reservedInventoryByProduct(products.map((product) => product.id));
  const lowInventory = products.filter((product) => product.inventory - (reserved.get(product.id) ?? 0) <= product.lowStockThreshold);

  return (
    <section className="admin-dashboard">
      <div className="admin-page-heading">
        <div>
          <span>Today</span>
          <h1>What needs attention?</h1>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-button primary" href="/admin/orders">
            <ShoppingBag aria-hidden size={16} /> Orders
          </Link>
          <Link className="admin-button" href="/admin/products">
            <ReceiptText aria-hidden size={16} /> Products
          </Link>
        </div>
      </div>

      <div className="admin-metric-grid">
        {statCard("Today's Orders", todaysOrders, "/admin/orders?status=today")}
        {statCard("Pending Orders", pendingOrders, "/admin/orders?status=pending", pendingOrders ? "warning" : "neutral")}
        {statCard("Orders in Production", craftingOrders, "/admin/orders?status=CRAFTING")}
        {statCard("Ready to Ship", readyOrders, "/admin/orders?status=PACKED")}
        {statCard("Delivered Today", deliveredToday, "/admin/orders?status=DELIVERED")}
        {statCard("Revenue Today", formatINR(revenueToday._sum.total ?? 0), "/admin/analytics")}
        {statCard("Revenue This Month", formatINR(revenueMonth._sum.total ?? 0), "/admin/analytics")}
        {statCard("Pending Payments", pendingPayments, "/admin/orders?payment=PENDING", pendingPayments ? "danger" : "neutral")}
        {statCard("Low Inventory", lowInventory.length, "/admin/inventory", lowInventory.length ? "warning" : "neutral")}
        {statCard("Failed Emails", failedEmails, "/admin/email-queue?status=FAILED", failedEmails ? "danger" : "neutral")}
      </div>

      <div className="admin-dashboard-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Low Inventory</h2>
            <Link href="/admin/inventory">Open</Link>
          </div>
          <div className="admin-compact-list">
            {lowInventory.slice(0, 8).map((product) => {
              const available = product.inventory - (reserved.get(product.id) ?? 0);

              return (
                <Link href="/admin/inventory" key={product.id}>
                  <AlertTriangle aria-hidden size={16} />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.category.name} / {available} available</small>
                  </span>
                </Link>
              );
            })}
            {lowInventory.length === 0 ? <p>No inventory alerts.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent Customers</h2>
            <Link href="/admin/customers">Open</Link>
          </div>
          <div className="admin-compact-list">
            {recentCustomers.map((customer) => (
              <Link href={`/admin/customers/${customer.id}`} key={customer.id}>
                <UserRound aria-hidden size={16} />
                <span>
                  <strong>{customer.name}</strong>
                  <small>{customer.email}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent Activity</h2>
            <Link href="/admin/orders">Orders</Link>
          </div>
          <div className="admin-compact-list">
            {recentActivity.map((activity) => (
              <Link href={`/admin/orders/${activity.order.orderNumber}`} key={activity.id}>
                <PackageCheck aria-hidden size={16} />
                <span>
                  <strong>{activity.title}</strong>
                  <small>{activity.order.orderNumber} / {activity.createdAt.toLocaleString("en-IN")}</small>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>Recent Contact Enquiries</h2>
            <Link href="/admin/contact-enquiries">Open</Link>
          </div>
          <div className="admin-compact-list">
            {recentEnquiries.map((enquiry) => (
              <Link href="/admin/contact-enquiries" key={enquiry.id}>
                <MailWarning aria-hidden size={16} />
                <span>
                  <strong>{enquiry.name}</strong>
                  <small>{enquiry.productType} / {enquiry.status}</small>
                </span>
              </Link>
            ))}
            {recentEnquiries.length === 0 ? <p>No enquiries yet.</p> : null}
          </div>
        </section>
      </div>

      <section className="admin-panel quick-actions-panel">
        <div className="admin-panel-heading">
          <h2>Quick Actions</h2>
        </div>
        <div className="admin-quick-actions">
          <Link href="/admin/orders?status=ORDER_RECEIVED">
            <ShoppingBag aria-hidden size={17} /> Review new orders
          </Link>
          <Link href="/admin/orders?status=PACKED">
            <Truck aria-hidden size={17} /> Ship packed orders
          </Link>
          <Link href="/admin/email-queue?status=FAILED">
            <MailWarning aria-hidden size={17} /> Fix failed emails
          </Link>
          <Link href="/admin/inventory">
            <AlertTriangle aria-hidden size={17} /> Restock attention items
          </Link>
        </div>
      </section>
    </section>
  );
}
