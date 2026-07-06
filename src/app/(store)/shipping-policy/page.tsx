import type { Metadata } from "next";
import { PolicyPage } from "@/components/business";
import { policyPages } from "@/lib/business-content";

export const metadata: Metadata = policyPages.shipping.metadata;

export default function ShippingPolicyPage() {
  return <PolicyPage content={policyPages.shipping} />;
}
