"use server";

import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defaultStoreSettings } from "@/lib/admin-data";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  getDefaultOrderStatusNote,
  getOrderStatusLabel,
  type OrderStatus,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent, eventForOrderStatus } from "@/lib/email";
import { enqueueEmail, processEmailQueue } from "@/lib/email/queue";
import { getAdminEmail } from "@/lib/email/emailSenders";
import { getRazorpayClient } from "@/lib/razorpay";
import { parseRupeesToPaise } from "@/lib/money";
import { requireAdmin } from "@/lib/session";

const defaultProductImage = "/assets/resin-hero.png";
const productUploadPath = "/uploads/products";
const productUploadDir = path.join(process.cwd(), "public", "uploads", "products");
const maxProductImageBytes = 8 * 1024 * 1024;

const defaultCustomizationFields = JSON.stringify([
  { name: "size", label: "Preferred size", type: "text", placeholder: "Example: 6 inch / 8 inch" },
  { name: "colors", label: "Preferred colors", type: "text", placeholder: "Example: teal, gold, white" },
  { name: "personalization", label: "Name/date/text", type: "text", placeholder: "Exact text if needed" },
  { name: "notes", label: "Customization notes", type: "textarea", placeholder: "Flowers, shells, finish, theme" },
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureJson(value: FormDataEntryValue | null, fallback = defaultCustomizationFields) {
  const text = String(value || "").trim();

  if (!text) {
    return fallback;
  }

  JSON.parse(text);
  return text;
}

function fieldName(value: string, index: number) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `custom_field_${index + 1}`;
}

function customizationFieldsFromForm(formData: FormData) {
  const labels = formData.getAll("customFieldLabel").map((value) => String(value || "").trim());

  if (!labels.length) {
    return ensureJson(formData.get("customizationFields"));
  }

  const names = formData.getAll("customFieldName").map((value) => String(value || "").trim());
  const types = formData.getAll("customFieldType").map((value) => String(value || "").trim());
  const placeholders = formData.getAll("customFieldPlaceholder").map((value) => String(value || "").trim());
  const fields = labels
    .map((label, index) => ({
      name: fieldName(names[index] || label, index),
      label,
      type: types[index] === "textarea" ? "textarea" : "text",
      placeholder: placeholders[index] || undefined,
    }))
    .filter((field) => field.label);

  return JSON.stringify(fields);
}

function imageExtension(file: File) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return extensions[file.type] ?? null;
}

function isProductImageFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

async function saveProductImage(value: FormDataEntryValue | null) {
  if (!isProductImageFile(value)) {
    return null;
  }

  const extension = imageExtension(value);

  if (!extension) {
    throw new Error("Product photos must be JPG, PNG, or WebP images.");
  }

  if (value.size > maxProductImageBytes) {
    throw new Error("Product photos must be smaller than 8MB.");
  }

  await mkdir(productUploadDir, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await value.arrayBuffer());

  await writeFile(path.join(productUploadDir, fileName), bytes);

  return `${productUploadPath}/${fileName}`;
}

function isUploadedProductImage(imageUrl: string) {
  return imageUrl.startsWith(`${productUploadPath}/`) && !imageUrl.includes("..");
}

async function deleteUploadedProductImage(imageUrl: string) {
  if (!isUploadedProductImage(imageUrl)) {
    return;
  }

  const fileName = path.basename(imageUrl);

  if (!fileName || fileName !== imageUrl.split("/").at(-1)) {
    return;
  }

  await rm(path.join(productUploadDir, fileName), { force: true });
}

function appUrl() {
  return (process.env.EMAIL_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function dateFromForm(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function couponValueFromForm(formData: FormData) {
  const type = String(formData.get("type") || "PERCENT").toUpperCase() === "FIXED" ? "FIXED" : "PERCENT";
  const rawValue = formData.get("value");
  const value = type === "FIXED" ? parseRupeesToPaise(rawValue) : Math.max(0, Math.round(Number(rawValue || 0)));

  return { type, value };
}

function revalidateAdminPaths(...paths: string[]) {
  const uniquePaths = new Set(["/admin", ...paths]);

  for (const pathName of uniquePaths) {
    revalidatePath(pathName);
  }
}

async function createInternalNote({
  targetType,
  targetId,
  content,
  authorId,
  orderId,
  userId,
  contactEnquiryId,
  reviewId,
}: {
  targetType: string;
  targetId: string;
  content: string;
  authorId?: string;
  orderId?: string;
  userId?: string;
  contactEnquiryId?: string;
  reviewId?: string;
}) {
  if (!content.trim()) {
    return null;
  }

  return prisma.internalNote.create({
    data: {
      targetType,
      targetId,
      content: content.trim(),
      authorId,
      orderId,
      userId,
      contactEnquiryId,
      reviewId,
    },
  });
}

async function productImageFromForm(formData: FormData, fallback = defaultProductImage) {
  const currentImageUrl = String(formData.get("currentImageUrl") || "");
  const uploadedImageUrl = await saveProductImage(formData.get("imageFile"));

  if (uploadedImageUrl) {
    await deleteUploadedProductImage(currentImageUrl);
    return uploadedImageUrl;
  }

  return String(formData.get("imageUrl") || fallback);
}

export async function createCategoryAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "");
  await prisma.category.create({
    data: {
      name,
      slug: slugify(String(formData.get("slug") || name)),
      description: String(formData.get("description") || ""),
      imageUrl: String(formData.get("imageUrl") || "/assets/resin-hero.png"),
      shippingFee: parseRupeesToPaise(formData.get("shippingFee")),
      sortOrder: Number(formData.get("sortOrder") || 0),
      isActive: formData.get("isActive") === "on",
      isFeatured: formData.get("isFeatured") === "on",
      metaTitle: String(formData.get("metaTitle") || "") || null,
      metaDescription: String(formData.get("metaDescription") || "") || null,
    },
  });

  revalidateAdminPaths("/admin/categories");
  revalidatePath("/products");
}

export async function updateCategoryAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "");
  await prisma.category.update({
    where: { id },
    data: {
      name,
      slug: slugify(String(formData.get("slug") || name)),
      description: String(formData.get("description") || ""),
      imageUrl: String(formData.get("imageUrl") || ""),
      shippingFee: parseRupeesToPaise(formData.get("shippingFee")),
      sortOrder: Number(formData.get("sortOrder") || 0),
      isActive: formData.get("isActive") === "on",
      isFeatured: formData.get("isFeatured") === "on",
      metaTitle: String(formData.get("metaTitle") || "") || null,
      metaDescription: String(formData.get("metaDescription") || "") || null,
    },
  });

  revalidateAdminPaths("/admin/categories");
  revalidatePath("/products");
}

export async function updateCategoryOrderAction(formData: FormData) {
  await requireAdmin();

  const ids = String(formData.get("categoryOrder") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  await Promise.all(
    ids.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidateAdminPaths("/admin/categories");
  revalidatePath("/products");
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") || "");
  const customizationFields = customizationFieldsFromForm(formData);
  const imageUrl = await productImageFromForm(formData);

  const product = await prisma.product.create({
    data: {
      categoryId: String(formData.get("categoryId") || ""),
      name,
      slug: slugify(String(formData.get("slug") || name)),
      description: String(formData.get("description") || ""),
      story: String(formData.get("story") || ""),
      price: parseRupeesToPaise(formData.get("price")),
      compareAtPrice: formData.get("compareAtPrice")
        ? parseRupeesToPaise(formData.get("compareAtPrice"))
        : null,
      imageUrl,
      inventory: Number(formData.get("inventory") || 0),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 3),
      adminStatus: formData.get("isActive") === "on" ? "PUBLISHED" : "DRAFT",
      isFeatured: formData.get("isFeatured") === "on",
      isActive: formData.get("isActive") === "on",
      handmadeDaysMin: Number(formData.get("handmadeDaysMin") || 5),
      handmadeDaysMax: Number(formData.get("handmadeDaysMax") || 12),
      customizationFields,
    },
  });

  if (product.inventory <= 0) {
    await dispatchEmailEvent("PRODUCT_OUT_OF_STOCK", { productId: product.id });
  } else if (product.inventory <= 3) {
    await dispatchEmailEvent("LOW_INVENTORY", { productId: product.id });
  }

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
}

export async function updateProductAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "");
  const customizationFields = customizationFieldsFromForm(formData);
  const imageUrl = await productImageFromForm(formData);

  const product = await prisma.product.update({
    where: { id },
    data: {
      categoryId: String(formData.get("categoryId") || ""),
      name,
      slug: slugify(String(formData.get("slug") || name)),
      description: String(formData.get("description") || ""),
      story: String(formData.get("story") || ""),
      price: parseRupeesToPaise(formData.get("price")),
      compareAtPrice: formData.get("compareAtPrice")
        ? parseRupeesToPaise(formData.get("compareAtPrice"))
        : null,
      imageUrl,
      inventory: Number(formData.get("inventory") || 0),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 3),
      adminStatus: String(formData.get("adminStatus") || (formData.get("isActive") === "on" ? "PUBLISHED" : "DRAFT")),
      archivedAt: String(formData.get("adminStatus") || "") === "ARCHIVED" ? new Date() : null,
      isFeatured: formData.get("isFeatured") === "on",
      isActive: formData.get("isActive") === "on",
      handmadeDaysMin: Number(formData.get("handmadeDaysMin") || 5),
      handmadeDaysMax: Number(formData.get("handmadeDaysMax") || 12),
      customizationFields,
    },
  });

  if (product.inventory <= 0) {
    await dispatchEmailEvent("PRODUCT_OUT_OF_STOCK", { productId: product.id });
  } else if (product.inventory <= 3) {
    await dispatchEmailEvent("LOW_INVENTORY", { productId: product.id });
  }

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
  revalidatePath(`/products/${product.slug}`);
}

export async function deleteProductPhotoAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const currentImageUrl = String(formData.get("currentImageUrl") || formData.get("imageUrl") || "");

  await deleteUploadedProductImage(currentImageUrl);

  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl: defaultProductImage },
  });

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
  revalidatePath(`/products/${product.slug}`);
}

export async function removeProductAction(formData: FormData) {
  await requireAdmin();

  await prisma.product.update({
    where: { id: String(formData.get("id") || "") },
    data: { isActive: false, adminStatus: "ARCHIVED", archivedAt: new Date() },
  });

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
}

export async function bulkProductAction(formData: FormData) {
  await requireAdmin();

  const action = String(formData.get("bulkAction") || "");
  const ids = formData.getAll("productId").map((value) => String(value)).filter(Boolean);

  if (!ids.length) {
    return;
  }

  if (action === "delete") {
    for (const id of ids) {
      const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });

      if (orderItemCount > 0) {
        await prisma.product.update({
          where: { id },
          data: { isActive: false, adminStatus: "ARCHIVED", archivedAt: new Date() },
        });
      } else {
        const product = await prisma.product.findUnique({ where: { id }, select: { imageUrl: true } });
        if (product?.imageUrl) {
          await deleteUploadedProductImage(product.imageUrl);
        }
        await prisma.product.delete({ where: { id } });
      }
    }
  }

  if (action === "archive") {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false, adminStatus: "ARCHIVED", archivedAt: new Date() },
    });
  }

  if (action === "publish") {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: true, adminStatus: "PUBLISHED", archivedAt: null },
    });
  }

  if (action === "draft") {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false, adminStatus: "DRAFT", archivedAt: null },
    });
  }

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
}

export async function quickUpdateProductAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const status = String(formData.get("adminStatus") || "PUBLISHED");
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: String(formData.get("name") || ""),
      categoryId: String(formData.get("categoryId") || ""),
      price: parseRupeesToPaise(formData.get("price")),
      inventory: Number(formData.get("inventory") || 0),
      lowStockThreshold: Number(formData.get("lowStockThreshold") || 3),
      adminStatus: status,
      isActive: status === "PUBLISHED",
      archivedAt: status === "ARCHIVED" ? new Date() : null,
    },
  });

  revalidateAdminPaths("/admin/products", "/admin/inventory");
  revalidatePath("/products");
  revalidatePath(`/products/${product.slug}`);
}

export async function restockProductAction(formData: FormData) {
  const admin = await requireAdmin();
  const productId = String(formData.get("productId") || "");
  const delta = Number(formData.get("delta") || 0);

  if (!productId || !Number.isFinite(delta) || delta === 0) {
    return;
  }

  await prisma.$transaction([
    prisma.product.update({
      where: { id: productId },
      data: { inventory: { increment: delta } },
    }),
    prisma.inventoryAdjustment.create({
      data: {
        productId,
        delta,
        reason: String(formData.get("reason") || "RESTOCK"),
        note: String(formData.get("note") || "") || null,
        actorId: admin.id,
      },
    }),
  ]);

  revalidateAdminPaths("/admin/inventory", "/admin/products");
  revalidatePath("/products");
}

export async function updateOrderAction(formData: FormData) {
  const admin = await requireAdmin();

  const status = z.enum(ORDER_STATUSES).parse(formData.get("status"));
  const paymentStatus = z.enum(PAYMENT_STATUSES).parse(formData.get("paymentStatus"));
  const orderId = String(formData.get("orderId") || "");
  const note = String(formData.get("note") || getDefaultOrderStatusNote(status));
  const courierTrackingId = String(formData.get("courierTrackingId") || "");
  const courierTrackingUrl = String(formData.get("courierTrackingUrl") || "");

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      paymentStatus,
      courierName: String(formData.get("courierName") || "") || null,
      courierTrackingId: courierTrackingId || null,
      courierTrackingUrl: courierTrackingUrl || null,
      awbCode: courierTrackingId || null,
      trackingUrl: courierTrackingUrl || null,
      shippedAt: status === "SHIPPED" ? new Date() : undefined,
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
      timeline: {
        create: {
          status,
          title: getOrderStatusLabel(status),
          note,
          actor: "ADMIN",
        },
      },
    },
  });

  await createInternalNote({
    targetType: "Order",
    targetId: order.id,
    orderId: order.id,
    authorId: admin.id,
    content: String(formData.get("internalNote") || ""),
  });

  await dispatchEmailEvent(eventForOrderStatus(status), {
    orderId: order.id,
    note,
    status,
  });
  revalidateAdminPaths("/admin/orders", `/admin/orders/${order.orderNumber}`);
  revalidatePath(`/orders/${order.orderNumber}`);
}

async function applyOrderStatusChange({
  orderId,
  status,
  note,
  actorId,
  internalNote,
}: {
  orderId: string;
  status: OrderStatus;
  note: string;
  actorId?: string;
  internalNote?: string;
}) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      shippedAt: status === "SHIPPED" ? new Date() : undefined,
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
      timeline: {
        create: {
          status,
          title: getOrderStatusLabel(status),
          note,
          actor: "ADMIN",
        },
      },
    },
  });

  if (internalNote && actorId) {
    await createInternalNote({
      targetType: "Order",
      targetId: order.id,
      orderId: order.id,
      authorId: actorId,
      content: internalNote,
    });
  }

  await dispatchEmailEvent(eventForOrderStatus(status), {
    orderId: order.id,
    note,
    status,
  });

  return order;
}

export async function moveOrderStatusAction(orderId: string, statusValue: string) {
  const admin = await requireAdmin();

  if (!orderId) {
    return;
  }

  const status = z.enum(ORDER_STATUSES).parse(statusValue);
  const note = getDefaultOrderStatusNote(status);
  const order = await applyOrderStatusChange({
    orderId,
    status,
    note,
    actorId: admin.id,
    internalNote: `Production board moved order to ${getOrderStatusLabel(status)}.`,
  });

  revalidateAdminPaths("/admin/production", "/admin/orders", `/admin/orders/${order.orderNumber}`);
  revalidatePath(`/orders/${order.orderNumber}`);
}

export async function bulkOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  const orderIds = formData.getAll("orderId").map((value) => String(value || "")).filter(Boolean);
  const bulkAction = String(formData.get("bulkAction") || "");

  if (!orderIds.length || !bulkAction) {
    return;
  }

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true },
  });

  if (!orders.length) {
    return;
  }

  if (bulkAction.startsWith("status:")) {
    const status = z.enum(ORDER_STATUSES).parse(bulkAction.replace("status:", ""));
    const note = getDefaultOrderStatusNote(status);

    for (const order of orders) {
      await applyOrderStatusChange({
        orderId: order.id,
        status,
        note,
        actorId: admin.id,
        internalNote: `Bulk action moved order to ${getOrderStatusLabel(status)}.`,
      });
    }
  } else if (bulkAction.startsWith("payment:")) {
    const paymentStatus = z.enum(PAYMENT_STATUSES).parse(bulkAction.replace("payment:", ""));

    await prisma.$transaction([
      prisma.order.updateMany({
        where: { id: { in: orders.map((order) => order.id) } },
        data: { paymentStatus },
      }),
      prisma.orderTimeline.createMany({
        data: orders.map((order) => ({
          orderId: order.id,
          status: order.status,
          title: "Payment status updated",
          note: `Payment marked ${paymentStatus.toLowerCase()} by bulk action.`,
          actor: "ADMIN",
          isCustomerVisible: false,
        })),
      }),
    ]);
  }

  revalidateAdminPaths("/admin/orders", "/admin/production");
  for (const order of orders) {
    revalidatePath(`/orders/${order.orderNumber}`);
    revalidatePath(`/admin/orders/${order.orderNumber}`);
  }
}

export async function addInternalNoteAction(formData: FormData) {
  const admin = await requireAdmin();
  const targetType = String(formData.get("targetType") || "");
  const targetId = String(formData.get("targetId") || "");

  await createInternalNote({
    targetType,
    targetId,
    authorId: admin.id,
    content: String(formData.get("content") || ""),
    orderId: String(formData.get("orderId") || "") || undefined,
    userId: String(formData.get("userId") || "") || undefined,
    contactEnquiryId: String(formData.get("contactEnquiryId") || "") || undefined,
    reviewId: String(formData.get("reviewId") || "") || undefined,
  });

  revalidateAdminPaths(
    "/admin/orders",
    "/admin/customers",
    "/admin/contact-enquiries",
    "/admin/reviews",
    String(formData.get("returnPath") || ""),
  );
}

export async function sendManualOrderEmailAction(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!orderId || !subject || !message) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order) {
    return;
  }

  await enqueueEmail({
    event: "ORDER_PROGRESS_UPDATED",
    to: order.user.email,
    subject,
    template: "CustomerMessage",
    role: "orders",
    orderId: order.id,
    userId: order.userId,
    data: {
      appUrl: appUrl(),
      supportEmail: getAdminEmail(),
      instagramUrl: "https://www.instagram.com/pour_n_art/",
      customerName: order.user.name,
      adminTitle: subject,
      message,
      preheader: subject,
    },
  });
  await createInternalNote({
    targetType: "Order",
    targetId: order.id,
    orderId: order.id,
    authorId: admin.id,
    content: `Manual email queued: ${subject}`,
  });

  revalidateAdminPaths(`/admin/orders/${order.orderNumber}`, "/admin/email-queue");
}

export async function sendCustomerEmailAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") || "");
  const subject = String(formData.get("subject") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!userId || !subject || !message) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return;
  }

  await enqueueEmail({
    event: "USER_CREATED",
    to: user.email,
    subject,
    template: "CustomerMessage",
    role: "studio",
    userId: user.id,
    data: {
      appUrl: appUrl(),
      supportEmail: getAdminEmail(),
      instagramUrl: "https://www.instagram.com/pour_n_art/",
      customerName: user.name,
      adminTitle: subject,
      message,
      preheader: subject,
    },
  });
  await createInternalNote({
    targetType: "User",
    targetId: user.id,
    userId: user.id,
    authorId: admin.id,
    content: `Manual customer email queued: ${subject}`,
  });

  revalidateAdminPaths(`/admin/customers/${user.id}`, "/admin/email-queue");
}

export async function resendOrderEmailAction(formData: FormData) {
  const event = String(formData.get("event") || "") as Parameters<typeof dispatchEmailEvent>[0];
  const orderId = String(formData.get("orderId") || "");

  await requireAdmin();

  if (!orderId || !event) {
    return;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { orderNumber: true } });
  await dispatchEmailEvent(event, { orderId });
  revalidateAdminPaths(order ? `/admin/orders/${order.orderNumber}` : "/admin/orders", "/admin/email-queue");
}

export async function refundOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  const reason = String(formData.get("reason") || "Admin refund").trim();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return;
  }

  let refundNote = "Refund recorded locally.";
  const razorpay = getRazorpayClient();

  if (razorpay && order.razorpayPaymentId) {
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: order.total,
      notes: { orderNumber: order.orderNumber, reason },
    });
    refundNote = `Razorpay refund requested: ${JSON.stringify(refund)}`;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "REFUNDED",
      timeline: {
        create: {
          status: order.status,
          title: "Refund processed",
          note: reason || refundNote,
          actor: "ADMIN",
          isCustomerVisible: false,
        },
      },
    },
  });
  await createInternalNote({
    targetType: "Order",
    targetId: order.id,
    orderId: order.id,
    authorId: admin.id,
    content: `${refundNote} ${reason}`.trim(),
  });

  revalidateAdminPaths("/admin/orders", `/admin/orders/${order.orderNumber}`);
}

export async function cancelOrderAction(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = String(formData.get("orderId") || "");
  const note = String(formData.get("note") || getDefaultOrderStatusNote("CANCELLED"));
  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "CANCELLED",
      timeline: {
        create: {
          status: "CANCELLED",
          title: getOrderStatusLabel("CANCELLED"),
          note,
          actor: "ADMIN",
        },
      },
    },
  });

  await createInternalNote({
    targetType: "Order",
    targetId: order.id,
    orderId: order.id,
    authorId: admin.id,
    content: `Order cancelled. ${note}`,
  });
  await dispatchEmailEvent("ORDER_CANCELLED", { orderId: order.id, note, status: "CANCELLED" });

  revalidateAdminPaths("/admin/orders", `/admin/orders/${order.orderNumber}`);
  revalidatePath(`/orders/${order.orderNumber}`);
}

export async function retryEmailAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  await prisma.emailQueue.update({
    where: { id },
    data: {
      status: "PENDING",
      attempts: 0,
      lastError: null,
      scheduledAt: new Date(),
    },
  });
  void processEmailQueue().catch((error) => {
    console.error("[admin:email-retry-failed]", error);
  });

  revalidateAdminPaths("/admin/email-queue");
}

export async function cancelEmailAction(formData: FormData) {
  await requireAdmin();

  await prisma.emailQueue.update({
    where: { id: String(formData.get("id") || "") },
    data: {
      status: "CANCELLED",
      lastError: "Cancelled by admin.",
    },
  });

  revalidateAdminPaths("/admin/email-queue");
}

export async function updateReviewAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "PENDING");
  const reply = String(formData.get("reply") || "").trim();

  await prisma.review.update({
    where: { id },
    data: {
      status,
      isFeatured: formData.get("isFeatured") === "on",
      reply: reply || null,
      repliedAt: reply ? new Date() : null,
    },
  });

  revalidateAdminPaths("/admin/reviews");
  revalidatePath("/products");
}

export async function updateContactEnquiryAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "NEW");
  const note = String(formData.get("note") || "");

  await prisma.contactEnquiry.update({
    where: { id },
    data: { status },
  });
  await createInternalNote({
    targetType: "ContactEnquiry",
    targetId: id,
    contactEnquiryId: id,
    authorId: admin.id,
    content: note,
  });

  revalidateAdminPaths("/admin/contact-enquiries");
}

export async function updateSettingsAction(formData: FormData) {
  await requireAdmin();

  await Promise.all(
    defaultStoreSettings.map((setting) =>
      prisma.storeSetting.upsert({
        where: { key: setting.key },
        update: { value: String(formData.get(setting.key) ?? setting.value) },
        create: {
          ...setting,
          value: String(formData.get(setting.key) ?? setting.value),
        },
      }),
    ),
  );

  revalidateAdminPaths("/admin/settings");
}

export async function markNotificationReadAction(formData: FormData) {
  await requireAdmin();

  await prisma.notification.update({
    where: { id: String(formData.get("id") || "") },
    data: { status: "READ", readAt: new Date() },
  });

  revalidateAdminPaths();
}

export async function markAllNotificationsReadAction() {
  await requireAdmin();

  await prisma.notification.updateMany({
    where: { status: "UNREAD" },
    data: { status: "READ", readAt: new Date() },
  });

  revalidateAdminPaths();
}

export async function createCouponAction(formData: FormData) {
  await requireAdmin();
  const { type, value } = couponValueFromForm(formData);

  await prisma.coupon.create({
    data: {
      code: String(formData.get("code") || "").toUpperCase(),
      description: String(formData.get("description") || ""),
      type,
      value,
      minSubtotal: parseRupeesToPaise(formData.get("minSubtotal")),
      usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : null,
      isActive: formData.get("isActive") === "on",
      startsAt: dateFromForm(formData.get("startsAt")),
      endsAt: dateFromForm(formData.get("endsAt")),
    },
  });

  revalidateAdminPaths("/admin/coupons");
}

export async function updateCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");

  if (!id) {
    return;
  }

  const { type, value } = couponValueFromForm(formData);

  await prisma.coupon.update({
    where: { id },
    data: {
      code: String(formData.get("code") || "").toUpperCase(),
      description: String(formData.get("description") || ""),
      type,
      value,
      minSubtotal: parseRupeesToPaise(formData.get("minSubtotal")),
      usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : null,
      isActive: formData.get("isActive") === "on",
      startsAt: dateFromForm(formData.get("startsAt")),
      endsAt: dateFromForm(formData.get("endsAt")),
    },
  });

  revalidateAdminPaths("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "");

  if (!id) {
    return;
  }

  await prisma.coupon.delete({ where: { id } });
  revalidateAdminPaths("/admin/coupons");
}

export async function updateBannerAction(formData: FormData) {
  await requireAdmin();

  await prisma.banner.upsert({
    where: { id: String(formData.get("id") || "home-hero") },
    update: {
      title: String(formData.get("title") || ""),
      subtitle: String(formData.get("subtitle") || ""),
      ctaLabel: String(formData.get("ctaLabel") || ""),
      ctaHref: String(formData.get("ctaHref") || "/products"),
      imageUrl: String(formData.get("imageUrl") || "/assets/resin-hero.png"),
      isActive: formData.get("isActive") === "on",
    },
    create: {
      id: String(formData.get("id") || "home-hero"),
      title: String(formData.get("title") || ""),
      subtitle: String(formData.get("subtitle") || ""),
      ctaLabel: String(formData.get("ctaLabel") || ""),
      ctaHref: String(formData.get("ctaHref") || "/products"),
      imageUrl: String(formData.get("imageUrl") || "/assets/resin-hero.png"),
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath("/");
  revalidateAdminPaths();
}
