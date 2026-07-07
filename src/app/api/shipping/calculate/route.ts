import { NextResponse } from "next/server";
import { z } from "zod";
import { checkoutItemSchema, craftingDaysForProducts, priceCheckoutCart } from "@/lib/cart-pricing";
import { formatINR } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";
import {
  applyCraftingTimeToCourier,
  calculateShippingRate,
  isShiprocketConfigured,
  shiprocketErrorMessage,
} from "@/lib/shiprocket";
import { requireUser } from "@/lib/session";

const shippingCalculateSchema = z.object({
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  cart: z.array(checkoutItemSchema).min(1, "Your cart is empty."),
});

export async function POST(request: Request) {
  const session = await requireUser();
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = rateLimit(`shipping-calculate:${session.id}:${forwardedFor}`, {
    limit: 20,
    windowMs: 60_000,
  });

  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many delivery checks. Please wait a moment and try again." },
      { status: 429 },
    );
  }

  const parsed = shippingCalculateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid delivery check." }, { status: 400 });
  }

  if (!isShiprocketConfigured()) {
    return NextResponse.json(
      { error: "Delivery rates are being configured. Please contact the studio before checkout." },
      { status: 503 },
    );
  }

  try {
    const pricedCart = await priceCheckoutCart(parsed.data.cart);
    const quote = await calculateShippingRate({
      deliveryPincode: parsed.data.pincode,
      declaredValue: pricedCart.subtotal,
    });
    const craftingDays = craftingDaysForProducts(pricedCart.products);
    const options = quote.options.map((option) => {
      const craftedOption = applyCraftingTimeToCourier(option, craftingDays.max);

      return {
        courierCompanyId: craftedOption.courierCompanyId,
        courierName: craftedOption.courierName,
        recommended: craftedOption.recommended,
        freightCharge: craftedOption.freightCharge,
        freightChargeLabel: formatINR(craftedOption.freightCharge),
        courierEstimatedDelivery: option.estimatedDelivery,
        estimatedDelivery: craftedOption.estimatedDelivery,
        estimatedDeliveryDate: craftedOption.estimatedDeliveryDate.toISOString(),
        transitDays: craftedOption.transitDays,
      };
    });
    const selectedOption = options[0];

    return NextResponse.json({
      serviceable: quote.serviceable,
      pincode: parsed.data.pincode,
      craftingDays,
      courierCompanyId: selectedOption?.courierCompanyId ?? quote.courierCompanyId,
      courierName: selectedOption?.courierName ?? quote.courierName,
      estimatedDelivery: selectedOption?.estimatedDelivery ?? quote.estimatedDelivery,
      freightCharge: selectedOption?.freightCharge ?? quote.freightCharge,
      freightChargeLabel: selectedOption?.freightChargeLabel ?? formatINR(quote.freightCharge),
      pickupPincode: quote.pickupPincode,
      options,
    });
  } catch (error) {
    return NextResponse.json(
      { error: shiprocketErrorMessage(error) || "Delivery check is unavailable right now." },
      { status: 503 },
    );
  }
}
