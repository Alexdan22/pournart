"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { dispatchEmailEvent } from "@/lib/email";
import { getRazorpayClient, isRazorpayConfigured } from "@/lib/razorpay";
import { requireUser } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
  customization: z.record(z.string(), z.string()).default({}),
});

const checkoutSchema = z.object({
  cart: z.array(checkoutItemSchema).min(1, "Your cart is empty."),
  deliveryName: z.string().min(2, "Enter a delivery name."),
  deliveryPhone: z.string().min(8, "Enter a delivery phone."),
  deliveryLine1: z.string().min(5, "Enter a delivery address."),
  deliveryLine2: z.string().optional(),
  deliveryCity: z.string().min(2, "Enter a city."),
  deliveryState: z.string().min(2, "Enter a state."),
  deliveryPincode: z.string().min(5, "Enter a pincode."),
  deliveryAddressLabel: z.string().min(2).max(30).default("Home"),
  saveAddress: z.boolean().default(true),
  customNotes: z.string().optional(),
});

function buildOrderNumber() {
  const suffix = Date.now().toString(36).toUpperCase();
  return `PNA-${suffix}`;
}

async function saveAddressForFutureOrders(userId: string, data: z.infer<typeof checkoutSchema>) {
  const line2 = data.deliveryLine2?.trim() || null;

  const existingAddress = await prisma.address.findFirst({
    where: {
      userId,
      line1: data.deliveryLine1.trim(),
      line2,
      city: data.deliveryCity.trim(),
      state: data.deliveryState.trim(),
      pincode: data.deliveryPincode.trim(),
      country: "India",
    },
  });

  if (existingAddress) {
    return existingAddress;
  }

  return prisma.address.create({
    data: {
      userId,
      label: data.deliveryAddressLabel.trim() || "Home",
      line1: data.deliveryLine1.trim(),
      line2,
      city: data.deliveryCity.trim(),
      state: data.deliveryState.trim(),
      pincode: data.deliveryPincode.trim(),
      country: "India",
    },
  });
}

export async function createOrderAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireUser();
  let cart: unknown;

  try {
    cart = JSON.parse(String(formData.get("cartJson") || "[]"));
  } catch {
    return { message: "Cart data could not be read. Please refresh and try again." };
  }

  const parsed = checkoutSchema.safeParse({
    cart,
    deliveryName: formData.get("deliveryName"),
    deliveryPhone: formData.get("deliveryPhone"),
    deliveryLine1: formData.get("deliveryLine1"),
    deliveryLine2: formData.get("deliveryLine2") || "",
    deliveryCity: formData.get("deliveryCity"),
    deliveryState: formData.get("deliveryState"),
    deliveryPincode: formData.get("deliveryPincode"),
    deliveryAddressLabel: formData.get("deliveryAddressLabel") || "Home",
    saveAddress: formData.get("saveAddress") === "on" || formData.get("saveAddress") === "true",
    customNotes: formData.get("customNotes") || "",
  });

  if (!parsed.success) {
    return {
      message: "Please check the checkout details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const productIds = parsed.data.cart.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(productIds).size) {
    return { message: "Some products in your cart are no longer available." };
  }

  let subtotal = 0;
  const orderItems = parsed.data.cart.map((item) => {
    const product = productById.get(item.productId);

    if (!product) {
      throw new Error(`Missing product ${item.productId}`);
    }

    subtotal += product.price * item.quantity;
    return {
      productId: product.id,
      productName: product.name,
      productImageUrl: product.imageUrl,
      unitPrice: product.price,
      quantity: item.quantity,
      customization: JSON.stringify(item.customization),
    };
  });

  const shippingFee = products
    .filter((product, index, allProducts) => {
      return allProducts.findIndex((candidate) => candidate.categoryId === product.categoryId) === index;
    })
    .reduce((total, product) => total + product.category.shippingFee, 0);
  const total = subtotal + shippingFee;
  const orderNumber = buildOrderNumber();

  if (parsed.data.saveAddress) {
    await saveAddressForFutureOrders(session.id, parsed.data);
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { phone: parsed.data.deliveryPhone },
  });

  let order = await prisma.order.create({
    data: {
      orderNumber,
      userId: session.id,
      subtotal,
      shippingFee,
      total,
      customNotes: parsed.data.customNotes || null,
      deliveryName: parsed.data.deliveryName,
      deliveryPhone: parsed.data.deliveryPhone,
      deliveryLine1: parsed.data.deliveryLine1,
      deliveryLine2: parsed.data.deliveryLine2 || null,
      deliveryCity: parsed.data.deliveryCity,
      deliveryState: parsed.data.deliveryState,
      deliveryPincode: parsed.data.deliveryPincode,
      items: { create: orderItems },
      timeline: {
        create: {
          status: "ORDER_RECEIVED",
          title: "Order Received",
          note: "We received your custom gift order details. Payment confirmation is pending.",
          actor: "CUSTOMER",
        },
      },
      status: "ORDER_RECEIVED",
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      event: "ORDER_CREATED",
      sessionId: String(formData.get("analyticsSessionId") || "") || null,
      userId: session.id,
      orderId: order.id,
      metadata: JSON.stringify({ total, subtotal, itemCount: orderItems.length }),
    },
  });

  if (isRazorpayConfigured()) {
    const razorpay = getRazorpayClient();

    if (razorpay) {
      const razorpayOrder = (await razorpay.orders.create({
        amount: total,
        currency: "INR",
        receipt: orderNumber,
        notes: {
          orderNumber,
          userId: session.id,
        },
      })) as { id: string };

      order = await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: razorpayOrder.id },
      });
    }
  }

  await dispatchEmailEvent("ORDER_PLACED", { orderId: order.id });
  revalidatePath("/account");
  revalidatePath("/checkout");

  redirect(`/checkout/payment/${order.orderNumber}`);
}

export async function markLocalPaymentPaidAction(formData: FormData) {
  const session = await requireUser();
  const orderNumber = String(formData.get("orderNumber") || "");

  if (isRazorpayConfigured()) {
    redirect(`/checkout/payment/${orderNumber}`);
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: session.id },
  });

  if (!order) {
    redirect("/orders");
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      status: "PAYMENT_CONFIRMED",
      timeline: {
        create: {
          status: "PAYMENT_CONFIRMED",
          title: "Payment Confirmed",
          note: "Local demo payment was marked as paid. Your custom gift is ready for design review.",
          actor: "SYSTEM",
        },
      },
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      event: "ORDER_PAID",
      userId: session.id,
      orderId: updatedOrder.id,
      metadata: JSON.stringify({ total: updatedOrder.total, source: "local" }),
    },
  });

  await dispatchEmailEvent("PAYMENT_CONFIRMED", { orderId: updatedOrder.id });
  redirect(`/orders/${updatedOrder.orderNumber}`);
}
