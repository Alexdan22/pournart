import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
  customization: z.record(z.string(), z.string()).default({}),
});

export type CheckoutCartItem = z.infer<typeof checkoutItemSchema>;

export class CartPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartPricingError";
  }
}

export async function priceCheckoutCart(cart: CheckoutCartItem[]) {
  const productIds = cart.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { category: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  if (products.length !== new Set(productIds).size) {
    throw new CartPricingError("Some products in your cart are no longer available.");
  }

  let subtotal = 0;
  const orderItems = cart.map((item) => {
    const product = productById.get(item.productId);

    if (!product) {
      throw new CartPricingError("Some products in your cart are no longer available.");
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

  return {
    subtotal,
    orderItems,
    products,
  };
}

export function craftingDaysForProducts(products: Array<{ handmadeDaysMin: number; handmadeDaysMax: number }>) {
  return {
    min: Math.max(0, ...products.map((product) => product.handmadeDaysMin)),
    max: Math.max(0, ...products.map((product) => product.handmadeDaysMax)),
  };
}
