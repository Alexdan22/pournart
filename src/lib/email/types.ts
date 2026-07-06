import type { OrderStatus } from "@/lib/constants";

export const EMAIL_EVENTS = [
  "USER_CREATED",
  "ORDER_PLACED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_FAILED",
  "ORDER_CONFIRMED",
  "ORDER_PRODUCTION_STARTED",
  "ORDER_PROGRESS_UPDATED",
  "ORDER_READY_TO_SHIP",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "REVIEW_REQUEST",
  "CONTACT_RECEIVED",
  "ABANDONED_CART",
  "LOW_INVENTORY",
  "PRODUCT_OUT_OF_STOCK",
  "EMAIL_PROVIDER_FAILURE",
  "INTERNAL_EMAIL_FAILURE",
] as const;

export type EmailEventName = (typeof EMAIL_EVENTS)[number];

export type EmailRole = "studio" | "orders" | "support" | "contact";

export type EmailTemplateName =
  | "Welcome"
  | "OrderPlaced"
  | "PaymentFailed"
  | "OrderConfirmed"
  | "ProductionStarted"
  | "ProductionProgress"
  | "ReadyToShip"
  | "OrderShipped"
  | "OrderDelivered"
  | "ReviewRequest"
  | "ContactConfirmation"
  | "ContactNotification"
  | "LowInventory"
  | "AdminNotification"
  | "CustomerMessage"
  | "AbandonedCart";

export type EmailQueueStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

export type EmailRecipient = {
  id?: string;
  email: string;
  name?: string | null;
};

export type EmailOrderItem = {
  name: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  customization?: Record<string, string>;
};

export type EmailAddress = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  country?: string;
};

export type EmailOrderSummary = {
  id: string;
  orderNumber: string;
  customer: EmailRecipient;
  items: EmailOrderItem[];
  subtotal: string;
  shippingFee: string;
  discount: string;
  total: string;
  paymentStatus: string;
  status: string;
  statusLabel: string;
  note?: string | null;
  shippingAddress: EmailAddress;
  estimatedDelivery?: string;
  orderUrl: string;
  paymentUrl: string;
  courierName?: string | null;
  courierTrackingId?: string | null;
  courierTrackingUrl?: string | null;
  dispatchEstimate?: string;
};

export type EmailProductSummary = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  inventory: number;
};

export type BaseTemplateData = {
  preheader?: string;
  appUrl: string;
  supportEmail: string;
  instagramUrl: string;
};

export type TemplateData = BaseTemplateData & {
  customerName?: string | null;
  order?: EmailOrderSummary;
  product?: EmailProductSummary;
  stage?: OrderStatus | "MATERIALS_SELECTED" | "RESIN_POURING" | "CURING_PROCESS" | "FINISHING" | "QUALITY_INSPECTION" | "PACKAGING";
  message?: string;
  adminTitle?: string;
  adminLines?: string[];
  contact?: {
    name: string;
    email: string;
    phone?: string;
    message: string;
  };
  cartItems?: EmailOrderItem[];
};

export type EmailJobInput = {
  to: string;
  subject: string;
  template: EmailTemplateName;
  data: TemplateData;
  event: EmailEventName;
  orderId?: string;
  userId?: string;
  contactEnquiryId?: string;
  role?: EmailRole;
  replyTo?: string;
  scheduledAt?: Date;
};

export type ProviderSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  role: EmailRole;
  replyTo?: string;
  metadata: {
    event: EmailEventName;
    queueId?: string;
  };
};

export type ProviderSendResult = {
  messageId?: string;
  response?: string;
};
