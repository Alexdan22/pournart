"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, GripVertical, Loader2, PackagePlus, RefreshCw, Truck } from "lucide-react";
import { moveOrderStatusAction } from "@/app/actions/admin";

export type ProductionBoardOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  productSummary: string;
  paymentStatus: string;
  totalLabel: string;
  createdAtLabel: string;
  status: string;
  shiprocketShipmentId: string | null;
  awbCode: string | null;
  courierName: string | null;
  shipmentStatus: string | null;
  shipmentError: string | null;
};

export type ProductionBoardColumn = {
  status: string;
  label: string;
  orders: ProductionBoardOrder[];
};

export function AdminProductionBoard({ columns: initialColumns }: { columns: ProductionBoardColumn[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [busyShippingAction, setBusyShippingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveOrder(orderId: string, nextStatus: string) {
    const currentColumn = columns.find((column) => column.orders.some((order) => order.id === orderId));
    const order = currentColumn?.orders.find((item) => item.id === orderId);

    if (!order || order.status === nextStatus) {
      return;
    }

    const movedOrder = { ...order, status: nextStatus };
    setColumns((current) =>
      current.map((column) => ({
        ...column,
        orders:
          column.status === nextStatus
            ? [movedOrder, ...column.orders.filter((item) => item.id !== orderId)]
            : column.orders.filter((item) => item.id !== orderId),
      })),
    );

    startTransition(() => {
      moveOrderStatusAction(orderId, nextStatus)
        .then(() => router.refresh())
        .catch(() => {
          setColumns(initialColumns);
          router.refresh();
        });
    });
  }

  async function runShippingAction(orderId: string, endpoint: string, key: string) {
    setBusyShippingAction(key);

    try {
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
    } finally {
      setBusyShippingAction(null);
      router.refresh();
    }
  }

  return (
    <div className={isPending ? "production-board is-pending" : "production-board"}>
      {columns.map((column) => (
        <section
          className={column.orders.length === 0 ? "production-column is-empty" : "production-column"}
          key={column.status}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedOrderId) {
              moveOrder(draggedOrderId, column.status);
              setDraggedOrderId(null);
            }
          }}
        >
          <header>
            <span>{column.label}</span>
            <strong>{column.orders.length}</strong>
          </header>
          <div className="production-card-list">
            {column.orders.map((order) => (
              <article
                className="production-card"
                draggable
                key={order.id}
                onDragEnd={() => setDraggedOrderId(null)}
                onDragStart={() => setDraggedOrderId(order.id)}
              >
                <div className="production-card-topline">
                  <GripVertical aria-hidden size={15} />
                  <Link href={`/admin/orders/${order.orderNumber}`}>{order.orderNumber}</Link>
                  <span>{order.totalLabel}</span>
                </div>
                <strong>{order.customerName}</strong>
                <small>{order.customerEmail}</small>
                <p>{order.productSummary}</p>
                <div className="production-card-footer">
                  <span className={`status-pill payment-${order.paymentStatus.toLowerCase()}`}>{order.paymentStatus}</span>
                  <time>{order.createdAtLabel}</time>
                </div>
                {order.status === "READY_FOR_PICKUP" ? (
                  <div className="production-shipping-panel">
                    {order.shiprocketShipmentId ? (
                      <span>
                        <Truck aria-hidden size={14} />
                        {order.courierName || "Courier pending"} {order.awbCode ? `/ ${order.awbCode}` : ""}
                      </span>
                    ) : (
                      <span>
                        <PackagePlus aria-hidden size={14} />
                        Shipment not created
                      </span>
                    )}
                    {order.shipmentStatus ? <small>{order.shipmentStatus}</small> : null}
                    {order.shipmentError ? <small className="admin-error-text">{order.shipmentError}</small> : null}
                    <div>
                      {!order.shiprocketShipmentId ? (
                        <button
                          className="admin-button"
                          disabled={Boolean(busyShippingAction)}
                          onClick={() => runShippingAction(order.id, "/api/admin/shiprocket/create-order", `${order.id}:create`)}
                          type="button"
                        >
                          {busyShippingAction === `${order.id}:create` ? <Loader2 aria-hidden className="spin" size={14} /> : <PackagePlus aria-hidden size={14} />}
                          Create
                        </button>
                      ) : null}
                      {order.awbCode ? (
                        <button
                          className="admin-button"
                          disabled={Boolean(busyShippingAction)}
                          onClick={() => runShippingAction(order.id, "/api/admin/shiprocket/refresh-tracking", `${order.id}:refresh`)}
                          type="button"
                        >
                          {busyShippingAction === `${order.id}:refresh` ? <Loader2 aria-hidden className="spin" size={14} /> : <RefreshCw aria-hidden size={14} />}
                          Refresh
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="production-card-actions">
                  <select
                    aria-label={`Move ${order.orderNumber}`}
                    value={order.status}
                    onChange={(event) => moveOrder(order.id, event.target.value)}
                  >
                    {columns.map((statusColumn) => (
                      <option value={statusColumn.status} key={statusColumn.status}>
                        {statusColumn.label}
                      </option>
                    ))}
                  </select>
                  <Link className="icon-action" href={`/admin/orders/${order.orderNumber}`} aria-label={`Open ${order.orderNumber}`}>
                    <ArrowRight aria-hidden size={15} />
                  </Link>
                </div>
              </article>
            ))}
            {column.orders.length === 0 ? <p className="admin-empty compact">No orders in this lane.</p> : null}
          </div>
        </section>
      ))}
    </div>
  );
}
