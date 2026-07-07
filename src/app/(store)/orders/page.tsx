import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";
import { AccountNav } from "@/components/account-nav";
import { getOrderStatusLabel, paymentStatusLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";

export default async function OrdersPage() {
  const session = await requireUser();
  const orders = await prisma.order.findMany({
    where: session.role === "ADMIN" ? {} : { userId: session.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="orders-page">
      <div className="section-heading">
        <span className="panel-label">Your Crafting Journey</span>
        <h1>Your handcrafted custom gift orders.</h1>
      </div>
      <AccountNav active="Orders" />
      <div className="orders-list">
        {orders.map((order) => (
          <Link className="order-row" href={`/orders/${order.orderNumber}`} key={order.id}>
            <span>{order.orderNumber}</span>
            <strong>{formatINR(order.total)}</strong>
            <small>{getOrderStatusLabel(order.status)}</small>
            <small>{paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] ?? order.paymentStatus}</small>
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="empty-state soft-empty">
          <PackageCheck aria-hidden size={34} />
          <h2>No orders yet.</h2>
          <p>Your crafting journey will appear here after checkout.</p>
          <Link className="primary-button" href="/products">
            Shop gifts <ArrowRight aria-hidden size={18} />
          </Link>
        </div>
      ) : null}
    </section>
  );
}
