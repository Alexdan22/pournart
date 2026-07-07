import type { Order, OrderItem, Product, User } from "@prisma/client";
import {
  getOrderStatusLabel,
  paymentStatusLabel,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { enqueueEmail } from "@/lib/email/queue";
import type {
  EmailEventName,
  EmailJobInput,
  EmailOrderSummary,
  EmailProductSummary,
  EmailRole,
  TemplateData,
} from "@/lib/email/types";
import { getAdminEmail } from "@/lib/email/emailSenders";

type EmailEventPayload = {
  userId?: string;
  orderId?: string;
  productId?: string;
  contactEnquiryId?: string;
  note?: string;
  status?: OrderStatus;
  stage?: TemplateData["stage"];
};

type OrderWithEmailData = Order & {
  user: User;
  items: OrderItem[];
};

function appUrl() {
  return (process.env.EMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function supportEmail() {
  return getAdminEmail();
}

function baseData(): Pick<TemplateData, "appUrl" | "supportEmail" | "instagramUrl"> {
  return {
    appUrl: appUrl(),
    supportEmail: supportEmail(),
    instagramUrl: "https://www.instagram.com/pour_n_art/",
  };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function estimateFromOrder(order: Pick<Order, "createdAt"> & { items: OrderItem[] }) {
  const maxDays = Math.max(7, ...order.items.map(() => 12));
  return addDays(order.createdAt, maxDays).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseCustomization(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, string>;

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function orderSummary(order: OrderWithEmailData, note?: string): EmailOrderSummary {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customer: {
      id: order.user.id,
      email: order.user.email,
      name: order.user.name,
    },
    items: order.items.map((item) => ({
      name: item.productName,
      imageUrl: item.productImageUrl,
      quantity: item.quantity,
      unitPrice: formatINR(item.unitPrice),
      lineTotal: formatINR(item.unitPrice * item.quantity),
      customization: parseCustomization(item.customization),
    })),
    subtotal: formatINR(order.subtotal),
    shippingFee: formatINR(order.shippingFee),
    discount: formatINR(order.discount),
    total: formatINR(order.total),
    paymentStatus: paymentStatusLabel[order.paymentStatus as PaymentStatus] || order.paymentStatus,
    status: order.status,
    statusLabel: getOrderStatusLabel(order.status),
    note,
    shippingAddress: {
      name: order.deliveryName,
      phone: order.deliveryPhone,
      line1: order.deliveryLine1,
      line2: order.deliveryLine2,
      city: order.deliveryCity,
      state: order.deliveryState,
      pincode: order.deliveryPincode,
      country: "India",
    },
    estimatedDelivery: order.estimatedDelivery
      ? order.estimatedDelivery.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : estimateFromOrder(order),
    orderUrl: `${appUrl()}/orders/${order.orderNumber}`,
    paymentUrl: `${appUrl()}/checkout/payment/${order.orderNumber}`,
    courierName: order.courierName,
    courierTrackingId: order.awbCode || order.courierTrackingId,
    courierTrackingUrl: order.trackingUrl || order.courierTrackingUrl,
    dispatchEstimate: addDays(new Date(), 1).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

function productSummary(product: Product): EmailProductSummary {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrl,
    inventory: product.inventory,
  };
}

async function getOrder(orderId?: string, note?: string) {
  if (!orderId) {
    return null;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });

  return order ? orderSummary(order, note) : null;
}

async function getUser(userId?: string) {
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({ where: { id: userId } });
}

async function getProduct(productId?: string) {
  if (!productId) {
    return null;
  }

  return prisma.product.findUnique({ where: { id: productId } });
}

async function getContactEnquiry(contactEnquiryId?: string) {
  if (!contactEnquiryId) {
    return null;
  }

  return prisma.contactEnquiry.findUnique({ where: { id: contactEnquiryId } });
}

function adminEmail() {
  return getAdminEmail();
}

function customerRole(event: EmailEventName): EmailRole {
  if (
    event === "ORDER_PLACED" ||
    event === "PAYMENT_CONFIRMED" ||
    event === "PAYMENT_FAILED" ||
    event === "ORDER_CONFIRMED" ||
    event === "ORDER_PRODUCTION_STARTED" ||
    event === "ORDER_PROGRESS_UPDATED" ||
    event === "ORDER_READY_TO_SHIP" ||
    event === "ORDER_SHIPPED" ||
    event === "SHIPMENT_UPDATED" ||
    event === "ORDER_DELIVERED" ||
    event === "ORDER_CANCELLED" ||
    event === "REVIEW_REQUEST"
  ) {
    return "orders";
  }

  if (event === "CONTACT_RECEIVED") {
    return "studio";
  }

  return "studio";
}

async function enqueueAll(jobs: EmailJobInput[]) {
  await Promise.all(jobs.filter((job) => job.to).map((job) => enqueueEmail(job)));
}

export async function dispatchEmailEvent(event: EmailEventName, payload: EmailEventPayload = {}) {
  try {
    const [order, user, product, contactEnquiry] = await Promise.all([
      getOrder(payload.orderId, payload.note),
      getUser(payload.userId),
      getProduct(payload.productId),
      getContactEnquiry(payload.contactEnquiryId),
    ]);
    const admin = adminEmail();
    const common = baseData();
    const jobs: EmailJobInput[] = [];

    if (event === "USER_CREATED" && user) {
      jobs.push({
        event,
        to: user.email,
        subject: "Welcome to Pour N Art",
        template: "Welcome",
        role: "studio",
        data: { ...common, customerName: user.name, preheader: "Your Pour N Art account is ready." },
      });
      jobs.push({
        event,
        to: admin,
        subject: "New Pour N Art customer registration",
        template: "AdminNotification",
        role: "contact",
        data: {
          ...common,
          adminTitle: "New customer registration",
          adminLines: [`Name: ${user.name}`, `Email: ${user.email}`, `Phone: ${user.phone || "Not provided"}`],
        },
      });
    }

    if (event === "ORDER_PLACED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Custom gift order received: ${order.orderNumber}`,
        template: "OrderPlaced",
        role: "orders",
        data: { ...common, order, preheader: `We received order ${order.orderNumber}.` },
      });
      jobs.push({
        event,
        to: admin,
        subject: `New order: ${order.orderNumber}`,
        template: "AdminNotification",
        role: "contact",
        data: {
          ...common,
          order,
          adminTitle: "New order received",
          adminLines: [`Order: ${order.orderNumber}`, `Customer: ${order.customer.name}`, `Total: ${order.total}`],
        },
      });
    }

    if (event === "PAYMENT_CONFIRMED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Payment confirmed: ${order.orderNumber}`,
        template: "OrderConfirmed",
        role: "orders",
        data: { ...common, order, preheader: `Payment is confirmed for ${order.orderNumber}.` },
      });
    }

    if (event === "PAYMENT_FAILED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Payment needs another try: ${order.orderNumber}`,
        template: "PaymentFailed",
        role: "orders",
        data: { ...common, order, preheader: `Payment did not complete for ${order.orderNumber}.` },
      });
      jobs.push({
        event,
        to: admin,
        subject: `Payment failed: ${order.orderNumber}`,
        template: "AdminNotification",
        role: "contact",
        data: { ...common, order, adminTitle: "Payment failed", adminLines: [`Order: ${order.orderNumber}`, `Customer: ${order.customer.email}`] },
      });
    }

    if (event === "ORDER_CONFIRMED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Order confirmed: ${order.orderNumber}`,
        template: "OrderConfirmed",
        role: customerRole(event),
        data: { ...common, order },
      });
    }

    if (event === "ORDER_PRODUCTION_STARTED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Handcrafting started: ${order.orderNumber}`,
        template: "ProductionStarted",
        role: customerRole(event),
        data: { ...common, order },
      });
    }

    if (event === "ORDER_PROGRESS_UPDATED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Crafting journey update: ${order.orderNumber}`,
        template: "ProductionProgress",
        role: customerRole(event),
        data: { ...common, order, stage: payload.stage || payload.status, message: payload.note },
      });
    }

    if (event === "ORDER_READY_TO_SHIP" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Packed with care: ${order.orderNumber}`,
        template: "ReadyToShip",
        role: customerRole(event),
        data: { ...common, order },
      });
    }

    if (event === "ORDER_SHIPPED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Your order is on the way: ${order.orderNumber}`,
        template: "OrderShipped",
        role: customerRole(event),
        data: { ...common, order },
      });
    }

    if (event === "SHIPMENT_UPDATED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Shipment update: ${order.orderNumber}`,
        template: "CustomerMessage",
        role: customerRole(event),
        data: {
          ...common,
          order,
          message: payload.note || "Your shipment has a fresh courier update.",
          preheader: `Shipment update for ${order.orderNumber}.`,
        },
      });
    }

    if (event === "ORDER_DELIVERED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Delivered: ${order.orderNumber}`,
        template: "OrderDelivered",
        role: customerRole(event),
        data: { ...common, order },
      });
      jobs.push({
        event: "REVIEW_REQUEST",
        to: order.customer.email,
        subject: `How did your Pour N Art piece feel?`,
        template: "ReviewRequest",
        role: "orders",
        scheduledAt: addDays(new Date(), 3),
        data: { ...common, order },
      });
    }

    if (event === "ORDER_CANCELLED" && order) {
      jobs.push({
        event,
        to: order.customer.email,
        subject: `Order cancelled: ${order.orderNumber}`,
        template: "ProductionProgress",
        role: customerRole(event),
        data: { ...common, order, message: payload.note || "This order has been cancelled. Reply to this email if you need help." },
      });
      jobs.push({
        event,
        to: admin,
        subject: `Order cancelled: ${order.orderNumber}`,
        template: "AdminNotification",
        role: "contact",
        data: { ...common, order, adminTitle: "Order cancelled", adminLines: [`Order: ${order.orderNumber}`, `Customer: ${order.customer.email}`] },
      });
    }

    if ((event === "LOW_INVENTORY" || event === "PRODUCT_OUT_OF_STOCK") && product) {
      jobs.push({
        event,
        to: admin,
        subject: event === "PRODUCT_OUT_OF_STOCK" ? `Out of stock: ${product.name}` : `Low inventory: ${product.name}`,
        template: "LowInventory",
        role: "contact",
        data: { ...common, product: productSummary(product) },
      });
    }

    if (event === "CONTACT_RECEIVED" && contactEnquiry) {
      const contact = {
        name: contactEnquiry.name,
        email: contactEnquiry.email || "",
        phone: contactEnquiry.phone,
        message: [
          `Occasion: ${contactEnquiry.occasion}`,
          `Product type: ${contactEnquiry.productType}`,
          `Budget: ${contactEnquiry.budget}`,
          contactEnquiry.message,
        ].join("\n"),
      };

      if (contactEnquiry.email) {
        jobs.push({
          event,
          contactEnquiryId: contactEnquiry.id,
          to: contactEnquiry.email,
          subject: "We received your Pour N Art custom request",
          template: "ContactConfirmation",
          role: "studio",
          data: { ...common, contact, preheader: "Your custom request has reached the studio." },
        });
      }

      jobs.push({
        event,
        contactEnquiryId: contactEnquiry.id,
        to: admin,
        subject: `New custom request: ${contactEnquiry.name}`,
        template: "ContactNotification",
        role: "contact",
        replyTo: contactEnquiry.email || undefined,
        data: { ...common, contact, preheader: "A new custom order enquiry needs review." },
      });
    }

    // TODO: ABANDONED_CART dispatch belongs in a future persisted cart/session workflow.
    // TODO: REVIEW_REQUEST can be expanded when product reviews are modeled in the database.

    await enqueueAll(
      jobs.map((job) => ({
        ...job,
        orderId: job.orderId ?? payload.orderId,
        userId: job.userId ?? order?.customer.id ?? payload.userId,
        contactEnquiryId: job.contactEnquiryId ?? payload.contactEnquiryId,
      })),
    );
  } catch (error) {
    console.error("[email:event-dispatch-failed]", event, error);
  }
}

export function eventForOrderStatus(status: OrderStatus): EmailEventName {
  const events: Record<OrderStatus, EmailEventName> = {
    ORDER_RECEIVED: "ORDER_PLACED",
    PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
    DESIGN_REVIEW: "ORDER_CONFIRMED",
    CRAFTING: "ORDER_PRODUCTION_STARTED",
    PACKED: "ORDER_READY_TO_SHIP",
    READY_FOR_PICKUP: "ORDER_READY_TO_SHIP",
    SHIPPED: "ORDER_SHIPPED",
    DELIVERED: "ORDER_DELIVERED",
    CANCELLED: "ORDER_CANCELLED",
  };

  return events[status];
}
