import Link from "next/link";
import { ArrowRight, PackageCheck } from "lucide-react";
import { AdminProductionBoard, type ProductionBoardColumn } from "@/components/admin-production-board";
import { adminOrderStatusLabel, paymentStatusLabel, type OrderStatus } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";

const productionStatuses = [
  "ORDER_RECEIVED",
  "PAYMENT_CONFIRMED",
  "DESIGN_REVIEW",
  "CRAFTING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
] as const satisfies readonly OrderStatus[];

export default async function AdminProductionPage() {
  const orders = await prisma.order.findMany({
    where: {
      status: { in: [...productionStatuses] },
      paymentStatus: { notIn: ["REFUNDED"] },
    },
    include: { user: true, items: true },
    orderBy: [{ createdAt: "asc" }],
    take: 250,
  });
  const columns: ProductionBoardColumn[] = productionStatuses.map((status) => ({
    status,
    label: adminOrderStatusLabel[status],
    orders: orders
      .filter((order) => order.status === status)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.user.name,
        customerEmail: order.user.email,
        productSummary: order.items.map((item) => `${item.productName} x${item.quantity}`).join(", "),
        paymentStatus: paymentStatusLabel[order.paymentStatus as keyof typeof paymentStatusLabel] || order.paymentStatus,
        totalLabel: formatINR(order.total),
        createdAtLabel: order.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        status: order.status,
      })),
  }));
  const blockedCount = orders.filter((order) => order.paymentStatus === "FAILED" || order.paymentStatus === "PENDING").length;

  return (
    <section className="admin-route">
      <div className="admin-page-heading">
        <div>
          <span>Production Board</span>
          <h1>Studio kanban</h1>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-button" href="/admin/orders?status=pending">
            New Orders <ArrowRight aria-hidden size={15} />
          </Link>
          <Link className="admin-button primary" href="/admin/orders?status=CRAFTING">
            <PackageCheck aria-hidden size={15} /> Crafting Queue
          </Link>
        </div>
      </div>

      <div className="admin-stat-row">
        <span><strong>{orders.length}</strong>Active production orders</span>
        <span><strong>{blockedCount}</strong>Payment follow-ups</span>
        <span><strong>{columns.at(-1)?.orders.length ?? 0}</strong>Shipping handoffs</span>
      </div>

      <AdminProductionBoard columns={columns} />
    </section>
  );
}
