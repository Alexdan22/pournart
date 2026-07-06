"use client";

const STORAGE_KEY = "pournart_analytics_session";

export function getAnalyticsSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const sessionId = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, sessionId);

  return sessionId;
}

export async function trackAnalyticsEvent(
  event: string,
  input: {
    productId?: string;
    orderId?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        sessionId: getAnalyticsSessionId(),
        ...input,
      }),
      keepalive: true,
    });
  } catch {
    // Analytics must never interrupt shopping.
  }
}
