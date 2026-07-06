"use server";

import { randomUUID } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  getDefaultOrderStatusNote,
  getOrderStatusLabel,
} from "@/lib/constants";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent, eventForOrderStatus } from "@/lib/email";
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
    },
  });

  revalidatePath("/admin");
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
    },
  });

  revalidatePath("/admin");
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

  revalidatePath("/admin");
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

  revalidatePath("/admin");
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

  revalidatePath("/admin");
  revalidatePath("/products");
  revalidatePath(`/products/${product.slug}`);
}

export async function removeProductAction(formData: FormData) {
  await requireAdmin();

  await prisma.product.update({
    where: { id: String(formData.get("id") || "") },
    data: { isActive: false },
  });

  revalidatePath("/admin");
  revalidatePath("/products");
}

export async function updateOrderAction(formData: FormData) {
  await requireAdmin();

  const status = z.enum(ORDER_STATUSES).parse(formData.get("status"));
  const paymentStatus = z.enum(PAYMENT_STATUSES).parse(formData.get("paymentStatus"));
  const orderId = String(formData.get("orderId") || "");
  const note = String(formData.get("note") || getDefaultOrderStatusNote(status));
  const courierTrackingUrl = String(formData.get("courierTrackingUrl") || "");

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      paymentStatus,
      courierName: String(formData.get("courierName") || "") || null,
      courierTrackingId: String(formData.get("courierTrackingId") || "") || null,
      courierTrackingUrl: courierTrackingUrl || null,
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

  await dispatchEmailEvent(eventForOrderStatus(status), {
    orderId: order.id,
    note,
    status,
  });
  revalidatePath("/admin");
  revalidatePath(`/orders/${order.orderNumber}`);
}

export async function createCouponAction(formData: FormData) {
  await requireAdmin();

  await prisma.coupon.create({
    data: {
      code: String(formData.get("code") || "").toUpperCase(),
      description: String(formData.get("description") || ""),
      type: String(formData.get("type") || "PERCENT"),
      value: Number(formData.get("value") || 0),
      minSubtotal: parseRupeesToPaise(formData.get("minSubtotal")),
      usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : null,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath("/admin");
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
  revalidatePath("/admin");
}
