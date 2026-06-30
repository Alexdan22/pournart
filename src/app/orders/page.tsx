import Link from "next/link";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/constants";
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
        <span className="panel-label">Order tracking</span>
        <h1>Your custom resin art orders.</h1>
      </div>
      <div className="orders-list">
        {orders.map((order) => (
          <Link className="order-row" href={`/orders/${order.orderNumber}`} key={order.id}>
            <span>{order.orderNumber}</span>
            <strong>{formatINR(order.total)}</strong>
            <small>{orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status}</small>
            <small>{paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] ?? order.paymentStatus}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
