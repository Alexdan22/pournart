import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { dispatchEmailEvent } from "@/lib/email";
import type { OrderStatus } from "@/lib/constants";
import { refreshTrackingForOrder, shiprocketErrorMessage } from "@/lib/shiprocket";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  await requireAdmin();

  const body = (await request.json().catch(() => ({}))) as { orderId?: string };
  const orderId = String(body.orderId || "");

  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  try {
    const result = await refreshTrackingForOrder(orderId);

    if (result.eventToDispatch) {
      await dispatchEmailEvent(result.eventToDispatch, {
        orderId: result.order.id,
        note: result.note,
        status: result.order.status as OrderStatus,
      });
    }

    revalidatePath("/admin/orders");
    revalidatePath("/admin/production");
    revalidatePath(`/admin/orders/${result.order.orderNumber}`);
    revalidatePath(`/orders/${result.order.orderNumber}`);

    return NextResponse.json({
      ok: true,
      orderNumber: result.order.orderNumber,
      shipmentStatus: result.order.shipmentStatus,
      trackingUrl: result.order.trackingUrl || result.order.courierTrackingUrl,
    });
  } catch (error) {
    return NextResponse.json({ error: shiprocketErrorMessage(error) }, { status: 400 });
  }
}
