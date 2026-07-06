"use client";

import { useEffect } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics-client";

type AnalyticsBeaconProps = {
  event: string;
  productId?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
};

export function AnalyticsBeacon({ event, productId, orderId, metadata }: AnalyticsBeaconProps) {
  useEffect(() => {
    void trackAnalyticsEvent(event, { productId, orderId, metadata });
  }, [event, metadata, orderId, productId]);

  return null;
}
