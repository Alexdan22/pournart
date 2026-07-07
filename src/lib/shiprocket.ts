import "server-only";

import type { Order, OrderItem, User } from "@prisma/client";
import type { OrderStatus } from "@/lib/constants";
import { prisma } from "@/lib/db";

const SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 9;

type JsonRecord = Record<string, unknown>;

type ShiprocketConfig = {
  email: string;
  password: string;
  pickupLocation: string;
  channelId?: number;
  pickupPincode: string;
  defaultWeight: number;
  defaultLength: number;
  defaultBreadth: number;
  defaultHeight: number;
};

export type ShiprocketCourierOption = {
  courierCompanyId: number | null;
  courierName: string | null;
  freightCharge: number;
  estimatedDelivery: string | null;
  estimatedDeliveryDate: Date | null;
  transitDays: number | null;
  recommended: boolean;
};

export type ShiprocketShippingQuote = ShiprocketCourierOption & {
  serviceable: boolean;
  pickupPincode: string;
  options: ShiprocketCourierOption[];
};

type OrderWithShipmentData = Order & {
  user: User;
  items: OrderItem[];
};

type TrackingUpdateResult = {
  order: Order;
  eventToDispatch: "ORDER_SHIPPED" | "ORDER_DELIVERED" | "SHIPMENT_UPDATED" | null;
  note: string;
};

const tokenCache: {
  token?: string;
  expiresAt?: number;
} = {};

export class ShiprocketError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ShiprocketError";
    this.status = status;
    this.payload = payload;
  }
}

function numberFrom(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function integerFrom(value: unknown) {
  const numberValue = numberFrom(value);
  return numberValue === null ? null : Math.round(numberValue);
}

function stringFrom(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function firstValue(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return null;
}

function firstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = stringFrom(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function parseArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord).filter((entry) => Object.keys(entry).length > 0) : [];
}

function getConfig(): ShiprocketConfig {
  const email = process.env.SHIPROCKET_EMAIL || "";
  const password = process.env.SHIPROCKET_PASSWORD || "";
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || "";
  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || "";

  if (!email || !password || !pickupLocation || !pickupPincode) {
    throw new ShiprocketError("Shiprocket credentials and pickup settings are not configured.");
  }

  return {
    email,
    password,
    pickupLocation,
    channelId: integerFrom(process.env.SHIPROCKET_CHANNEL_ID) ?? undefined,
    pickupPincode,
    defaultWeight: numberFrom(process.env.SHIPROCKET_DEFAULT_WEIGHT) ?? 0.5,
    defaultLength: numberFrom(process.env.SHIPROCKET_DEFAULT_LENGTH) ?? 20,
    defaultBreadth: numberFrom(process.env.SHIPROCKET_DEFAULT_BREADTH) ?? 20,
    defaultHeight: numberFrom(process.env.SHIPROCKET_DEFAULT_HEIGHT) ?? 5,
  };
}

export function isShiprocketConfigured() {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}

function messageFromPayload(payload: unknown) {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const errors = firstValue(record, ["errors", "error"]);
  const message =
    firstString(record, ["message", "error", "status_message"]) ||
    firstString(data, ["message", "error", "status_message"]);

  if (message) {
    return message;
  }

  if (Array.isArray(errors)) {
    return errors.map((entry) => String(entry)).join(", ");
  }

  if (errors && typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>)
      .flat()
      .map((entry) => String(entry))
      .join(", ");
  }

  return "Shiprocket request failed.";
}

export function shiprocketErrorMessage(error: unknown) {
  if (error instanceof ShiprocketError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Shiprocket request failed.";
}

async function readResponsePayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function authenticate(force = false) {
  const config = getConfig();

  if (!force && tokenCache.token && tokenCache.expiresAt && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const response = await fetch(`${SHIPROCKET_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
    cache: "no-store",
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ShiprocketError(messageFromPayload(payload), response.status, payload);
  }

  const record = asRecord(payload);
  const data = asRecord(record.data);
  const token = firstString(record, ["token"]) || firstString(data, ["token"]);

  if (!token) {
    throw new ShiprocketError("Shiprocket authentication did not return a token.", response.status, payload);
  }

  tokenCache.token = token;
  tokenCache.expiresAt = Date.now() + TOKEN_TTL_MS;

  return token;
}

async function shiprocketRequest<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await authenticate();
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${SHIPROCKET_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  const payload = await readResponsePayload(response);

  if (response.status === 401 && retry) {
    tokenCache.token = undefined;
    tokenCache.expiresAt = undefined;
    await authenticate(true);
    return shiprocketRequest<T>(path, init, false);
  }

  if (!response.ok) {
    throw new ShiprocketError(messageFromPayload(payload), response.status, payload);
  }

  return payload as T;
}

function rupeesToPaise(value: unknown) {
  const rupees = numberFrom(value);
  return rupees === null ? 0 : Math.max(0, Math.round(rupees * 100));
}

function paiseToRupees(value: number) {
  return Number((value / 100).toFixed(2));
}

function formatOrderDate(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseEstimatedDelivery(courier: JsonRecord) {
  const raw =
    firstString(courier, ["estimated_delivery_date", "edd", "etd", "delivery_date"]) ||
    firstString(asRecord(courier.other_charges), ["etd"]);
  const parsedDate = raw ? new Date(raw) : null;
  const hasParsedDate = Boolean(parsedDate && Number.isFinite(parsedDate.getTime()));
  const rawDayMatches = raw?.match(/\d+/g)?.map(Number).filter((entry) => Number.isFinite(entry)) || [];
  const days =
    integerFrom(firstValue(courier, ["estimated_delivery_days", "delivery_days", "etd_days"])) ||
    (!hasParsedDate && rawDayMatches.length ? Math.max(...rawDayMatches) : null);
  const date =
    parsedDate && hasParsedDate
      ? parsedDate
      : days
        ? addDays(new Date(), days)
        : null;

  return {
    date,
    days,
    label: date
      ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : raw || (days ? `${days} days` : null),
  };
}

function daysBetween(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
}

function courierOptionFromRecord(courier: JsonRecord, recommendedId: number | null): ShiprocketCourierOption | null {
  const courierCompanyId = integerFrom(firstValue(courier, ["courier_company_id", "courier_id", "id"]));
  const freightCharge = rupeesToPaise(firstValue(courier, ["freight_charge", "rate", "shipping_charge", "freight_charges"]));
  const estimatedDelivery = parseEstimatedDelivery(courier);

  if (!courierCompanyId || freightCharge <= 0) {
    return null;
  }

  return {
    courierCompanyId,
    courierName: firstString(courier, ["courier_name", "courier_company", "name"]),
    freightCharge,
    estimatedDelivery: estimatedDelivery.label,
    estimatedDeliveryDate: estimatedDelivery.date,
    transitDays: estimatedDelivery.days ?? (estimatedDelivery.date ? daysBetween(new Date(), estimatedDelivery.date) : null),
    recommended: recommendedId === courierCompanyId,
  };
}

function normalizeServiceability(payload: unknown, pickupPincode: string): ShiprocketShippingQuote {
  const record = asRecord(payload);
  const data = asRecord(record.data);
  const couriers = parseArray(data.available_courier_companies).length
    ? parseArray(data.available_courier_companies)
    : parseArray(record.available_courier_companies);

  if (!couriers.length) {
    return {
      serviceable: false,
      courierCompanyId: null,
      courierName: null,
      freightCharge: 0,
      estimatedDelivery: null,
      estimatedDeliveryDate: null,
      transitDays: null,
      recommended: false,
      pickupPincode,
      options: [],
    };
  }

  const recommendedId = integerFrom(firstValue(data, ["recommended_courier_company_id", "recommendation_id"]));
  const options = couriers
    .map((courier) => courierOptionFromRecord(courier, recommendedId))
    .filter((option): option is ShiprocketCourierOption => Boolean(option))
    .sort((first, second) => {
      if (first.recommended !== second.recommended) {
        return first.recommended ? -1 : 1;
      }

      return first.freightCharge - second.freightCharge;
    });
  const selected = options[0];

  if (!selected) {
    return {
      serviceable: false,
      courierCompanyId: null,
      courierName: null,
      freightCharge: 0,
      estimatedDelivery: null,
      estimatedDeliveryDate: null,
      transitDays: null,
      recommended: false,
      pickupPincode,
      options: [],
    };
  }

  return {
    serviceable: true,
    ...selected,
    pickupPincode,
    options,
  };
}

export function applyCraftingTimeToCourier(option: ShiprocketCourierOption, craftingDays: number, now = new Date()) {
  const transitDays = option.transitDays ?? (option.estimatedDeliveryDate ? daysBetween(now, option.estimatedDeliveryDate) : 0);
  const estimatedDeliveryDate = addDays(now, craftingDays + transitDays);

  return {
    ...option,
    estimatedDelivery: estimatedDeliveryDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    estimatedDeliveryDate,
    transitDays,
  };
}

export async function calculateShippingRate({
  deliveryPincode,
  declaredValue,
}: {
  deliveryPincode: string;
  declaredValue: number;
}) {
  const config = getConfig();
  const search = new URLSearchParams({
    pickup_postcode: config.pickupPincode,
    delivery_postcode: deliveryPincode,
    cod: "0",
    weight: String(config.defaultWeight),
    length: String(config.defaultLength),
    breadth: String(config.defaultBreadth),
    height: String(config.defaultHeight),
    declared_value: String(paiseToRupees(declaredValue)),
  });
  const payload = await shiprocketRequest<unknown>(`/courier/serviceability/?${search.toString()}`, {
    method: "GET",
  });

  return normalizeServiceability(payload, config.pickupPincode);
}

function buildTrackingUrl(awbCode?: string | null) {
  return awbCode
    ? `https://www.shiprocket.in/shipment-tracking/?awb=${encodeURIComponent(awbCode)}`
    : "https://www.shiprocket.in/shipment-tracking/";
}

function buildShiprocketOrderPayload(order: OrderWithShipmentData) {
  const config = getConfig();
  const payload: JsonRecord = {
    order_id: order.orderNumber,
    order_date: formatOrderDate(order.createdAt),
    pickup_location: config.pickupLocation,
    billing_customer_name: order.deliveryName,
    billing_last_name: "",
    billing_address: order.deliveryLine1,
    billing_address_2: order.deliveryLine2 || "",
    billing_city: order.deliveryCity,
    billing_pincode: order.deliveryPincode,
    billing_state: order.deliveryState,
    billing_country: "India",
    billing_email: order.user.email,
    billing_phone: order.deliveryPhone,
    shipping_is_billing: true,
    order_items: order.items.map((item) => ({
      name: item.productName,
      sku: item.productId || item.id,
      units: item.quantity,
      selling_price: paiseToRupees(item.unitPrice),
      discount: 0,
      tax: 0,
    })),
    payment_method: "Prepaid",
    sub_total: paiseToRupees(order.subtotal),
    shipping_charges: paiseToRupees(order.shippingFee || order.shippingCharge),
    length: config.defaultLength,
    breadth: config.defaultBreadth,
    height: config.defaultHeight,
    weight: config.defaultWeight,
  };

  if (config.channelId) {
    payload.channel_id = config.channelId;
  }

  return payload;
}

function parseCreatedOrder(payload: unknown) {
  const record = asRecord(payload);
  const data = asRecord(record.data);

  return {
    shiprocketOrderId:
      firstString(record, ["order_id", "shiprocket_order_id"]) ||
      firstString(data, ["order_id", "shiprocket_order_id"]),
    shiprocketShipmentId:
      firstString(record, ["shipment_id", "shiprocket_shipment_id"]) ||
      firstString(data, ["shipment_id", "shiprocket_shipment_id"]),
  };
}

async function saveShipmentError(orderId: string, error: unknown) {
  await prisma.order.update({
    where: { id: orderId },
    data: { shipmentError: shiprocketErrorMessage(error) },
  });
}

export async function createShiprocketOrderForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });

  if (!order) {
    throw new ShiprocketError("Order not found.");
  }

  if (order.paymentStatus !== "PAID") {
    throw new ShiprocketError("Shiprocket order can be created only after payment is marked paid.");
  }

  if (order.shiprocketOrderId && order.shiprocketShipmentId) {
    return order;
  }

  try {
    const payload = await shiprocketRequest<unknown>("/orders/create/adhoc", {
      method: "POST",
      body: JSON.stringify(buildShiprocketOrderPayload(order)),
    });
    const created = parseCreatedOrder(payload);

    if (!created.shiprocketOrderId || !created.shiprocketShipmentId) {
      throw new ShiprocketError("Shiprocket did not return order and shipment ids.", undefined, payload);
    }

    return prisma.order.update({
      where: { id: order.id },
      data: {
        shiprocketOrderId: created.shiprocketOrderId,
        shiprocketShipmentId: created.shiprocketShipmentId,
        pickupPincode: getConfig().pickupPincode,
        shipmentStatus: "SHIPROCKET_ORDER_CREATED",
        shipmentError: null,
        timeline: {
          create: {
            status: order.status,
            title: "Shiprocket order created",
            note: "A Shiprocket shipment was created for this paid order.",
            actor: "SYSTEM",
            isCustomerVisible: false,
          },
        },
      },
    });
  } catch (error) {
    await saveShipmentError(order.id, error);
    throw error;
  }
}

export async function createShiprocketOrderAfterPayment(orderId: string) {
  try {
    return await createShiprocketOrderForOrder(orderId);
  } catch (error) {
    console.error("[shiprocket:create-after-payment-failed]", orderId, error);
    return null;
  }
}

function parseAwb(payload: unknown) {
  const record = asRecord(payload);
  const response = asRecord(record.response);
  const data = asRecord(response.data);
  const nestedData = Object.keys(data).length ? data : asRecord(record.data);
  const source = Object.keys(nestedData).length ? nestedData : record;
  const awbCode = firstString(source, ["awb_code", "awb", "awbCode"]);

  return {
    awbCode,
    courierName: firstString(source, ["courier_name", "courier_company_name", "courier_company"]),
    courierCompanyId: integerFrom(firstValue(source, ["courier_company_id", "courier_id"])),
    trackingUrl: firstString(source, ["tracking_url", "track_url"]),
  };
}

export async function assignAwbForOrder(orderId: string, courierCompanyId?: number | null) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new ShiprocketError("Order not found.");
  }

  if (!order.shiprocketShipmentId) {
    throw new ShiprocketError("Create the Shiprocket shipment before assigning an AWB.");
  }

  if (order.awbCode) {
    return order;
  }

  const courierId = courierCompanyId || order.courierCompanyId;

  if (!courierId) {
    throw new ShiprocketError("No courier company is attached to this order.");
  }

  try {
    const payload = await shiprocketRequest<unknown>("/courier/assign/awb", {
      method: "POST",
      body: JSON.stringify({
        shipment_id: Number(order.shiprocketShipmentId) || order.shiprocketShipmentId,
        courier_id: courierId,
      }),
    });
    const awb = parseAwb(payload);

    if (!awb.awbCode) {
      throw new ShiprocketError("Shiprocket did not return an AWB code.", undefined, payload);
    }

    const trackingUrl = awb.trackingUrl || buildTrackingUrl(awb.awbCode);

    return prisma.order.update({
      where: { id: order.id },
      data: {
        awbCode: awb.awbCode,
        courierCompanyId: awb.courierCompanyId || courierId,
        courierName: awb.courierName || order.courierName,
        courierTrackingId: awb.awbCode,
        courierTrackingUrl: trackingUrl,
        trackingUrl,
        shipmentStatus: "AWB_ASSIGNED",
        shipmentError: null,
        timeline: {
          create: {
            status: order.status,
            title: "AWB assigned",
            note: `Tracking number ${awb.awbCode} was assigned${awb.courierName ? ` with ${awb.courierName}` : ""}.`,
            actor: "SYSTEM",
          },
        },
      },
    });
  } catch (error) {
    await saveShipmentError(order.id, error);
    throw error;
  }
}

export async function generatePickupForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new ShiprocketError("Order not found.");
  }

  if (!order.shiprocketShipmentId) {
    throw new ShiprocketError("Create the Shiprocket shipment before generating pickup.");
  }

  if (!order.awbCode && !order.courierTrackingId) {
    throw new ShiprocketError("Assign an AWB before generating pickup.");
  }

  try {
    await shiprocketRequest<unknown>("/courier/generate/pickup", {
      method: "POST",
      body: JSON.stringify({
        shipment_id: [Number(order.shiprocketShipmentId) || order.shiprocketShipmentId],
      }),
    });

    return prisma.order.update({
      where: { id: order.id },
      data: {
        pickupGenerated: true,
        shipmentStatus: "PICKUP_GENERATED",
        shipmentError: null,
        timeline: {
          create: {
            status: order.status,
            title: "Pickup generated",
            note: "Shiprocket pickup has been requested for this shipment.",
            actor: "SYSTEM",
            isCustomerVisible: false,
          },
        },
      },
    });
  } catch (error) {
    await saveShipmentError(order.id, error);
    throw error;
  }
}

function normalizeTrackingEvents(payload: unknown) {
  const record = asRecord(payload);
  const trackingData = asRecord(record.tracking_data);
  const shipmentTrack = parseArray(trackingData.shipment_track);
  const firstTrack = shipmentTrack[0] || {};
  const activities = parseArray(trackingData.shipment_track_activities).length
    ? parseArray(trackingData.shipment_track_activities)
    : parseArray(record.shipment_track_activities);
  const currentStatus =
    firstString(firstTrack, ["current_status", "shipment_status", "status"]) ||
    firstString(trackingData, ["current_status", "shipment_status", "status"]) ||
    firstString(record, ["current_status", "shipment_status", "status"]);

  return {
    currentStatus,
    trackingUrl: firstString(firstTrack, ["tracking_url"]) || firstString(trackingData, ["tracking_url"]),
    events: activities.map((activity) => ({
      date: firstString(activity, ["date", "activity_date", "scan_date"]),
      status: firstString(activity, ["status", "sr-status", "shipment_status"]) || undefined,
      activity: firstString(activity, ["activity", "details", "remark", "scan"]) || "Shipment update",
      location: firstString(activity, ["location", "scan_location", "city"]) || undefined,
    })),
  };
}

function orderStatusFromShipmentStatus(status: string | null): OrderStatus | null {
  const normalized = (status || "").toLowerCase();

  if (normalized.includes("delivered")) {
    return "DELIVERED";
  }

  if (
    normalized.includes("picked") ||
    normalized.includes("shipped") ||
    normalized.includes("in transit") ||
    normalized.includes("out for delivery")
  ) {
    return "SHIPPED";
  }

  return null;
}

export async function refreshTrackingForOrder(orderId: string): Promise<TrackingUpdateResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new ShiprocketError("Order not found.");
  }

  const awbCode = order.awbCode || order.courierTrackingId;

  if (!awbCode) {
    throw new ShiprocketError("Assign an AWB before refreshing tracking.");
  }

  try {
    const payload = await shiprocketRequest<unknown>(`/courier/track/awb/${encodeURIComponent(awbCode)}`, {
      method: "GET",
    });
    const tracking = normalizeTrackingEvents(payload);
    const nextOrderStatus = orderStatusFromShipmentStatus(tracking.currentStatus);
    const orderStatusChanged = Boolean(nextOrderStatus && nextOrderStatus !== order.status);
    const shipmentStatusChanged = Boolean(tracking.currentStatus && tracking.currentStatus !== order.shipmentStatus);
    const trackingUrl = tracking.trackingUrl || order.trackingUrl || order.courierTrackingUrl || buildTrackingUrl(awbCode);
    const note = tracking.currentStatus
      ? `Shiprocket status: ${tracking.currentStatus}.`
      : "Shiprocket tracking was refreshed.";

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        shipmentStatus: tracking.currentStatus || order.shipmentStatus,
        trackingEvents: JSON.stringify(tracking.events),
        trackingUrl,
        courierTrackingUrl: trackingUrl,
        shipmentError: null,
        status: nextOrderStatus || undefined,
        shippedAt: nextOrderStatus === "SHIPPED" && !order.shippedAt ? new Date() : undefined,
        deliveredAt: nextOrderStatus === "DELIVERED" && !order.deliveredAt ? new Date() : undefined,
        timeline: shipmentStatusChanged || orderStatusChanged
          ? {
              create: {
                status: nextOrderStatus || order.status,
                title: nextOrderStatus ? (nextOrderStatus === "DELIVERED" ? "Delivered" : "Shipped") : "Shipment update",
                note,
                actor: "SYSTEM",
              },
            }
          : undefined,
      },
    });

    return {
      order: updatedOrder,
      eventToDispatch: orderStatusChanged
        ? nextOrderStatus === "DELIVERED"
          ? "ORDER_DELIVERED"
          : "ORDER_SHIPPED"
        : shipmentStatusChanged
          ? "SHIPMENT_UPDATED"
          : null,
      note,
    };
  } catch (error) {
    await saveShipmentError(order.id, error);
    throw error;
  }
}
