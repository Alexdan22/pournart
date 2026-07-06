export const ORDER_STATUSES = [
  "ORDER_RECEIVED",
  "PAYMENT_CONFIRMED",
  "DESIGN_REVIEW",
  "CRAFTING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderStatusLabel: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "Order Received",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  DESIGN_REVIEW: "Design Reviewed",
  CRAFTING: "Being Handcrafted",
  PACKED: "Packed with Care",
  READY_FOR_PICKUP: "Ready for Pickup",
  SHIPPED: "On the Way",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const adminOrderStatusLabel: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "Order Received",
  PAYMENT_CONFIRMED: "Payment Confirmed",
  DESIGN_REVIEW: "Design Review",
  CRAFTING: "Crafting",
  PACKED: "Packed",
  READY_FOR_PICKUP: "Ready for Pickup",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const customerJourneyStatuses = [
  "ORDER_RECEIVED",
  "PAYMENT_CONFIRMED",
  "DESIGN_REVIEW",
  "CRAFTING",
  "PACKED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "DELIVERED",
] as const satisfies readonly OrderStatus[];

export const legacyOrderStatusAliases = {
  PLACED: "ORDER_RECEIVED",
  IN_MAKING: "CRAFTING",
  OUT_FOR_DELIVERY: "SHIPPED",
} as const satisfies Record<string, OrderStatus>;

export const adminOrderQueues = [
  { key: "new-orders", label: "New Orders", statuses: ["ORDER_RECEIVED", "PAYMENT_CONFIRMED"] },
  { key: "design-review", label: "Design Review", statuses: ["DESIGN_REVIEW"] },
  { key: "crafting", label: "Crafting", statuses: ["CRAFTING"] },
  { key: "packed", label: "Packed", statuses: ["PACKED"] },
  { key: "ready-for-pickup", label: "Ready for Pickup", statuses: ["READY_FOR_PICKUP"] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] },
  { key: "delivered", label: "Delivered", statuses: ["DELIVERED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
] as const satisfies readonly {
  key: string;
  label: string;
  statuses: readonly OrderStatus[];
}[];

export type AdminOrderQueueKey = (typeof adminOrderQueues)[number]["key"];

export const orderStatusQueueKey: Record<OrderStatus, AdminOrderQueueKey> = {
  ORDER_RECEIVED: "new-orders",
  PAYMENT_CONFIRMED: "new-orders",
  DESIGN_REVIEW: "design-review",
  CRAFTING: "crafting",
  PACKED: "packed",
  READY_FOR_PICKUP: "ready-for-pickup",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const actionRequiredOrderStatuses = [
  "ORDER_RECEIVED",
  "PAYMENT_CONFIRMED",
  "DESIGN_REVIEW",
  "CRAFTING",
  "PACKED",
  "READY_FOR_PICKUP",
] as const satisfies readonly OrderStatus[];

export const defaultOrderStatusNotes: Record<OrderStatus, string> = {
  ORDER_RECEIVED: "We received the custom gift order details and are waiting for payment confirmation.",
  PAYMENT_CONFIRMED: "Payment is confirmed. The custom gift is ready for design review.",
  DESIGN_REVIEW: "The personalized piece design has been reviewed and approved for handcrafting.",
  CRAFTING: "The custom gift is being handcrafted with the selected personalization details.",
  PACKED: "The custom gift has been packed with care.",
  READY_FOR_PICKUP: "The custom gift is ready for pickup.",
  SHIPPED: "The custom gift is on the way.",
  DELIVERED: "The custom gift has been delivered.",
  CANCELLED: "The custom gift order has been cancelled.",
};

export function normalizeOrderStatus(status: string | null | undefined): OrderStatus | null {
  if (!status) {
    return null;
  }

  if ((ORDER_STATUSES as readonly string[]).includes(status)) {
    return status as OrderStatus;
  }

  return legacyOrderStatusAliases[status as keyof typeof legacyOrderStatusAliases] ?? null;
}

export function getOrderStatusLabel(status: string | null | undefined) {
  const normalizedStatus = normalizeOrderStatus(status);

  return normalizedStatus ? orderStatusLabel[normalizedStatus] : String(status || "");
}

export function getAdminOrderStatusLabel(status: string | null | undefined) {
  const normalizedStatus = normalizeOrderStatus(status);

  return normalizedStatus ? adminOrderStatusLabel[normalizedStatus] : String(status || "");
}

export function getAdminOrderQueueKey(status: string | null | undefined) {
  const normalizedStatus = normalizeOrderStatus(status);

  return normalizedStatus ? orderStatusQueueKey[normalizedStatus] : null;
}

export function getDefaultOrderStatusNote(status: OrderStatus) {
  return defaultOrderStatusNotes[status];
}

export const defaultWhatsAppMessage =
  "Hi Pour n Art, I would like to create a custom handcrafted gift.";
