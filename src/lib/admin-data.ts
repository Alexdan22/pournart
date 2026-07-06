import type { Prisma } from "@prisma/client";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  actionRequiredOrderStatuses,
  normalizeOrderStatus,
  type OrderStatus,
} from "@/lib/constants";
import { prisma } from "@/lib/db";

export const adminPageSize = 20;
export const lowInventoryDefault = 3;

export const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/email-queue", label: "Email Queue" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/contact-enquiries", label: "Enquiries" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export type AdminTableSearchParams = {
  q?: string;
  status?: string;
  payment?: string;
  page?: string;
  sort?: string;
  direction?: string;
};

export function numberParam(value?: string, fallback = 1) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function pagination(page?: string) {
  const currentPage = numberParam(page);

  return {
    page: currentPage,
    take: adminPageSize,
    skip: (currentPage - 1) * adminPageSize,
  };
}

export function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / adminPageSize));
}

export function todayRange(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function monthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return { start, end };
}

export function isActiveOrderStatus(status: string) {
  const normalized = normalizeOrderStatus(status);

  return Boolean(normalized && normalized !== "DELIVERED" && normalized !== "CANCELLED");
}

export function activeOrderWhere(): Prisma.OrderWhereInput {
  return {
    status: { notIn: ["DELIVERED", "CANCELLED"] },
    paymentStatus: { notIn: ["FAILED", "REFUNDED"] },
  };
}

export async function reservedInventoryByProduct(productIds?: string[]) {
  const items = await prisma.orderItem.findMany({
    where: {
      productId: productIds?.length ? { in: productIds } : { not: null },
      order: activeOrderWhere(),
    },
    select: {
      productId: true,
      quantity: true,
    },
  });
  const reserved = new Map<string, number>();

  for (const item of items) {
    if (item.productId) {
      reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
    }
  }

  return reserved;
}

export async function syncDerivedNotifications() {
  const [failedPayments, failedEmails, pendingReviews, newOrders, products] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "FAILED" },
      select: { id: true, orderNumber: true, user: { select: { name: true } } },
      take: 20,
    }),
    prisma.emailQueue.findMany({
      where: { status: "FAILED" },
      select: { id: true, recipient: true, subject: true },
      take: 20,
    }),
    prisma.review.findMany({
      where: { status: "PENDING" },
      select: { id: true, product: { select: { name: true } } },
      take: 20,
    }),
    prisma.order.findMany({
      where: { status: { in: ["ORDER_RECEIVED", "PAYMENT_CONFIRMED"] } },
      select: { id: true, orderNumber: true, total: true },
      take: 20,
    }),
    prisma.product.findMany({
      select: { id: true, name: true, inventory: true, lowStockThreshold: true },
      take: 200,
    }),
  ]);

  const reserved = await reservedInventoryByProduct(products.map((product) => product.id));
  const lowInventory = products.filter((product) => {
    const available = product.inventory - (reserved.get(product.id) ?? 0);
    return available <= product.lowStockThreshold;
  });

  await Promise.all([
    ...failedPayments.map((order) =>
      upsertNotification({
        type: "FAILED_PAYMENT",
        title: `Failed payment: ${order.orderNumber}`,
        body: `${order.user.name} needs payment follow-up.`,
        href: `/admin/orders/${order.orderNumber}`,
        severity: "CRITICAL",
        sourceType: "Order",
        sourceId: order.id,
      }),
    ),
    ...failedEmails.map((email) =>
      upsertNotification({
        type: "EMAIL_FAILURE",
        title: "Email failed",
        body: `${email.subject} to ${email.recipient}`,
        href: "/admin/email-queue?status=FAILED",
        severity: "WARNING",
        sourceType: "EmailQueue",
        sourceId: email.id,
      }),
    ),
    ...pendingReviews.map((review) =>
      upsertNotification({
        type: "NEW_REVIEW",
        title: "Review awaiting moderation",
        body: review.product.name,
        href: "/admin/reviews?status=PENDING",
        severity: "INFO",
        sourceType: "Review",
        sourceId: review.id,
      }),
    ),
    ...newOrders.map((order) =>
      upsertNotification({
        type: "NEW_ORDER",
        title: `New order: ${order.orderNumber}`,
        body: `Order total ${order.total}`,
        href: `/admin/orders/${order.orderNumber}`,
        severity: "INFO",
        sourceType: "Order",
        sourceId: order.id,
      }),
    ),
    ...lowInventory.map((product) =>
      upsertNotification({
        type: "LOW_INVENTORY",
        title: "Low inventory",
        body: `${product.name} has ${product.inventory - (reserved.get(product.id) ?? 0)} available.`,
        href: "/admin/inventory",
        severity: "WARNING",
        sourceType: "Product",
        sourceId: product.id,
      }),
    ),
  ]);
}

async function upsertNotification(input: {
  type: string;
  title: string;
  body: string;
  href?: string;
  severity: string;
  sourceType: string;
  sourceId: string;
}) {
  await prisma.notification.upsert({
    where: {
      type_sourceType_sourceId: {
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    update: {
      title: input.title,
      body: input.body,
      href: input.href,
      severity: input.severity,
      status: "UNREAD",
      readAt: null,
    },
    create: {
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      severity: input.severity,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
  });
}

export async function getUnreadNotifications(take = 12) {
  await syncDerivedNotifications();

  return prisma.notification.findMany({
    where: { status: "UNREAD" },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export const defaultStoreSettings = [
  { key: "brand.name", group: "Brand Details", label: "Brand name", value: "Pour n Art", valueType: "text" },
  { key: "store.info", group: "Store Information", label: "Store description", value: "Premium handmade resin gifts and personalized keepsakes.", valueType: "textarea" },
  { key: "business.address", group: "Business Address", label: "Business address", value: "", valueType: "textarea" },
  { key: "shipping.defaultCharge", group: "Shipping Charges", label: "Default shipping charge", value: "0", valueType: "number" },
  { key: "email.roles", group: "Email Roles", label: "Role sender policy", value: "studio, orders, support, contact", valueType: "textarea" },
  { key: "tax.defaultRate", group: "Tax Settings", label: "Default tax rate", value: "0", valueType: "number" },
  { key: "seo.title", group: "SEO Defaults", label: "Default SEO title", value: "Pour n Art | Handcrafted Custom Gifts", valueType: "text" },
  { key: "seo.description", group: "SEO Defaults", label: "Default SEO description", value: "Premium handmade custom gifts and personalized resin keepsakes.", valueType: "textarea" },
  { key: "social.instagram", group: "Social Links", label: "Instagram URL", value: "https://www.instagram.com/pour_n_art/", valueType: "text" },
  { key: "contact.email", group: "Contact Details", label: "Contact email", value: "pournart@gmail.com", valueType: "email" },
] as const;

export async function ensureDefaultSettings() {
  await Promise.all(
    defaultStoreSettings.map((setting) =>
      prisma.storeSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      }),
    ),
  );
}

export function providerStatus() {
  return {
    resend: Boolean(process.env.RESEND_API_KEY),
    razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    razorpayWebhook: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
    queueSecret: Boolean(process.env.EMAIL_QUEUE_SECRET),
  };
}

export function validOrderStatus(value: string): OrderStatus {
  if ((ORDER_STATUSES as readonly string[]).includes(value)) {
    return value as OrderStatus;
  }

  return "ORDER_RECEIVED";
}

export function validPaymentStatus(value: string) {
  return (PAYMENT_STATUSES as readonly string[]).includes(value) ? value : "PENDING";
}

export const adminAttentionStatuses = new Set<string>(actionRequiredOrderStatuses);
