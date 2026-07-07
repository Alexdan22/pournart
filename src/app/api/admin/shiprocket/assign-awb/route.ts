import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { dispatchEmailEvent } from "@/lib/email";
import { assignAwbForOrder, shiprocketErrorMessage } from "@/lib/shiprocket";
import { requireAdmin } from "@/lib/session";

export async function POST(request: Request) {
  await requireAdmin();

  const body = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    courierCompanyId?: number | string | null;
  };
  const orderId = String(body.orderId || "");
  const courierCompanyId = body.courierCompanyId ? Number(body.courierCompanyId) : null;

  if (!orderId) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  try {
    const order = await assignAwbForOrder(orderId, Number.isFinite(courierCompanyId) ? courierCompanyId : null);

    await dispatchEmailEvent("SHIPMENT_UPDATED", {
      orderId: order.id,
      note: `Tracking number ${order.awbCode || order.courierTrackingId} has been assigned.`,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/production");
    revalidatePath(`/admin/orders/${order.orderNumber}`);
    revalidatePath(`/orders/${order.orderNumber}`);

    return NextResponse.json({
      ok: true,
      orderNumber: order.orderNumber,
      awbCode: order.awbCode,
      courierName: order.courierName,
      trackingUrl: order.trackingUrl || order.courierTrackingUrl,
      shipmentStatus: order.shipmentStatus,
    });
  } catch (error) {
    return NextResponse.json({ error: shiprocketErrorMessage(error) }, { status: 400 });
  }
}
