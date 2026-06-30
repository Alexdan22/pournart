import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { orderStatusLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { requireUser } from "@/lib/session";

export default async function AccountPage() {
  const session = await requireUser();
  const orders = await prisma.order.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <section className="account-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Account</span>
          <h1>Hello, {session.name}</h1>
        </div>
        <form action={logoutAction}>
          <button className="secondary-button" type="submit">
            <LogOut aria-hidden size={18} /> Logout
          </button>
        </form>
      </div>

      <div className="orders-list">
        {orders.map((order) => (
          <Link className="order-row" href={`/orders/${order.orderNumber}`} key={order.id}>
            <span>{order.orderNumber}</span>
            <strong>{formatINR(order.total)}</strong>
            <small>{orderStatusLabel[order.status as keyof typeof orderStatusLabel] ?? order.status}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
