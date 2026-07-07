import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createShiprocketOrderForOrder, shiprocketErrorMessage } from "@/lib/shiprocket";
import { requireAdmin } from "@/lib/session";

async function readOrderId(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  return String(body.orderId || "");
}

export async function POST(request: Request) {
  await requireAdmin();

  const orderId = await readOrderId(request);

  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  try {
    const order = await createShiprocketOrderForOrder(orderId);

    revalidatePath("/admin/orders");
    revalidatePath("/admin/production");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/orders/${order.orderNumber}`);

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      shiprocketOrderId: order.shiprocketOrderId,
      shiprocketShipmentId: order.shiprocketShipmentId,
      shipmentStatus: order.shipmentStatus,
    });
  } catch (error) {
    return NextResponse.json({ error: shiprocketErrorMessage(error) }, { status: 400 });
  }
}
