export type ShipmentTrackingEvent = {
  date?: string;
  status?: string;
  activity: string;
  location?: string;
};

function isTrackingEvent(value: unknown): value is ShipmentTrackingEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<ShipmentTrackingEvent>;
  return typeof event.activity === "string" && event.activity.length > 0;
}

export function parseTrackingEvents(value?: string | null): ShipmentTrackingEvent[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTrackingEvent) : [];
  } catch {
    return [];
  }
}

export function trackingEventLabel(event: ShipmentTrackingEvent) {
  return [event.status, event.activity].filter(Boolean).join(" - ") || "Shipment update";
}
