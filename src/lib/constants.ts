export const ORDER_STATUSES = [
  "PLACED",
  "PAYMENT_CONFIRMED",
  "IN_MAKING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

export const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const orderStatusLabel: Record<OrderStatus, string> = {
  PLACED: "Placed",
  PAYMENT_CONFIRMED: "Payment confirmed",
  IN_MAKING: "In making",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

export const manualOrderStatuses = ["PLACED", "PAYMENT_CONFIRMED", "IN_MAKING", "PACKED"] as const;

export const courierOrderStatuses = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export const defaultWhatsAppMessage =
  "Hi Pour n Art, I would like to discuss a custom resin art order.";
