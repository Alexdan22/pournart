import type { Metadata } from "next";
import { PolicyPage } from "@/components/business";
import { policyPages } from "@/lib/business-content";

export const metadata: Metadata = policyPages.privacy.metadata;

export default function PrivacyPolicyPage() {
  return <PolicyPage content={policyPages.privacy} />;
}
