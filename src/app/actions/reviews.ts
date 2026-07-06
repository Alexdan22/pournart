"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const reviewSchema = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().min(1),
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(90).optional(),
  body: z.string().min(8, "Write a little about the piece.").max(1200),
});

export async function createReviewAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser();
  const parsed = reviewSchema.safeParse({
    orderId: formData.get("orderId"),
    orderItemId: formData.get("orderItemId"),
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    title: formData.get("title") || "",
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return {
      message: "Please check your review.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const order = await prisma.order.findFirst({
    where: {
      id: parsed.data.orderId,
      userId: session.role === "ADMIN" ? undefined : session.id,
      status: "DELIVERED",
      items: {
        some: {
          id: parsed.data.orderItemId,
          productId: parsed.data.productId,
        },
      },
    },
    include: { items: true },
  });

  if (!order) {
    return { message: "Reviews can be added after this order is delivered." };
  }

  const review = await prisma.review.upsert({
    where: {
      orderItemId_userId: {
        orderItemId: parsed.data.orderItemId,
        userId: session.id,
      },
    },
    update: {
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      status: "PENDING",
    },
    create: {
      orderId: order.id,
      orderItemId: parsed.data.orderItemId,
      productId: parsed.data.productId,
      userId: session.id,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
    },
  });

  await prisma.notification.upsert({
    where: {
      type_sourceType_sourceId: {
        type: "NEW_REVIEW",
        sourceType: "Review",
        sourceId: review.id,
      },
    },
    update: {
      status: "UNREAD",
      readAt: null,
      title: "Review awaiting moderation",
      body: `Order ${order.orderNumber}`,
      href: "/admin/reviews?status=PENDING",
    },
    create: {
      type: "NEW_REVIEW",
      title: "Review awaiting moderation",
      body: `Order ${order.orderNumber}`,
      href: "/admin/reviews?status=PENDING",
      severity: "INFO",
      sourceType: "Review",
      sourceId: review.id,
    },
  });

  revalidatePath(`/orders/${order.orderNumber}`);
  revalidatePath("/admin/reviews");
  revalidatePath("/products");

  return { ok: true, message: "Review saved for moderation. Thank you." };
}
