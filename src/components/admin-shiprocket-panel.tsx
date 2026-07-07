"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Loader2, PackagePlus, RefreshCw, Send, Truck } from "lucide-react";

type AdminShiprocketPanelProps = {
  order: {
    id: string;
    paymentStatus: string;
    shiprocketOrderId: string | null;
    shiprocketShipmentId: string | null;
    awbCode: string | null;
    courierCompanyId: number | null;
    courierName: string | null;
    shipmentStatus: string | null;
    trackingUrl: string | null;
    courierTrackingUrl: string | null;
    pickupGenerated: boolean;
    shipmentError: string | null;
  };
};

type ShiprocketAction = {
  key: string;
  label: string;
  endpoint: string;
  icon: "create" | "awb" | "pickup" | "refresh";
  disabled?: boolean;
};

const icons = {
  create: PackagePlus,
  awb: Truck,
  pickup: Send,
  refresh: RefreshCw,
};

export function AdminShiprocketPanel({ order }: AdminShiprocketPanelProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const trackingUrl = order.trackingUrl || order.courierTrackingUrl;
  const actions: ShiprocketAction[] = [
    {
      key: "create-order",
      label: order.shiprocketShipmentId ? "Retry Shipment" : "Create Shipment",
      endpoint: "/api/admin/shiprocket/create-order",
      icon: "create",
      disabled: order.paymentStatus !== "PAID",
    },
    {
      key: "assign-awb",
      label: "Assign AWB",
      endpoint: "/api/admin/shiprocket/assign-awb",
      icon: "awb",
      disabled: !order.shiprocketShipmentId || Boolean(order.awbCode),
    },
    {
      key: "generate-pickup",
      label: order.pickupGenerated ? "Pickup Generated" : "Generate Pickup",
      endpoint: "/api/admin/shiprocket/generate-pickup",
      icon: "pickup",
      disabled: !order.shiprocketShipmentId || !order.awbCode || order.pickupGenerated,
    },
    {
      key: "refresh-tracking",
      label: "Refresh Tracking",
      endpoint: "/api/admin/shiprocket/refresh-tracking",
      icon: "refresh",
      disabled: !order.awbCode,
    },
  ];

  async function runAction(action: ShiprocketAction) {
    setMessage("");
    setBusyAction(action.key);

    try {
      const response = await fetch(action.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          courierCompanyId: order.courierCompanyId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Shiprocket action failed.");
      }

      setMessage("Shipment details updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Shiprocket action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="admin-panel shiprocket-panel">
      <div className="admin-panel-heading">
        <h2>Shiprocket</h2>
        {trackingUrl ? (
          <a href={trackingUrl} target="_blank" rel="noreferrer">
            Track <ExternalLink aria-hidden size={14} />
          </a>
        ) : null}
      </div>
      <dl className="admin-definition-list">
        <dt>Status</dt>
        <dd>{order.shipmentStatus || "Not created"}</dd>
        <dt>Shipment ID</dt>
        <dd>{order.shiprocketShipmentId || "Not created"}</dd>
        <dt>Courier</dt>
        <dd>{order.courierName || "Not assigned"}</dd>
        <dt>AWB</dt>
        <dd>{order.awbCode || "Not assigned"}</dd>
      </dl>
      {order.shipmentError ? <p className="admin-error-text">{order.shipmentError}</p> : null}
      {message ? <p className={message.includes("failed") || message.includes("required") ? "admin-error-text" : "admin-success-text"}>{message}</p> : null}
      <div className="shiprocket-action-grid">
        {actions.map((action) => {
          const Icon = icons[action.icon];
          const isBusy = busyAction === action.key;

          return (
            <button
              className="admin-button"
              disabled={action.disabled || Boolean(busyAction)}
              key={action.key}
              onClick={() => runAction(action)}
              type="button"
            >
              {isBusy ? <Loader2 aria-hidden className="spin" size={15} /> : <Icon aria-hidden size={15} />}
              {action.label}
            </button>
          );
        })}
      </div>
      {order.paymentStatus !== "PAID" ? <p className="summary-note">Shipment creation unlocks after payment is paid.</p> : null}
    </section>
  );
}
