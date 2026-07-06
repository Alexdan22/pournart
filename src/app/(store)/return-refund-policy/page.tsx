import type { Metadata } from "next";
import { PolicyPage } from "@/components/business";
import { policyPages } from "@/lib/business-content";

export const metadata: Metadata = policyPages.returnRefund.metadata;

export default function ReturnRefundPolicyPage() {
  return <PolicyPage content={policyPages.returnRefund} />;
}
