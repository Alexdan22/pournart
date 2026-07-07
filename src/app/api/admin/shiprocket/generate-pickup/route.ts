import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { generatePickupForOrder, shiprocketErrorMessage } from "@/lib/shiprocket";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  await requireAdmin();

  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  const orderId = String(body.orderId || "");

  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  try {
    const order = await generatePickupForOrder(orderId);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/production");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/orders/${order.orderNumber}`);

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      pickupGenerated: order.pickupGenerated,
      shipmentStatus: order.shipmentStatus,
    });
  } catch (error) {
    return NextResponse.json({ error: shiprocketErrorMessage(error) }, { status: 400 });
  }
}
