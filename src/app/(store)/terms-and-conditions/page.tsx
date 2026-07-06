import type { Metadata } from "next";
import { PolicyPage } from "@/components/business";
import { policyPages } from "@/lib/business-content";

export const metadata: Metadata = policyPages.terms.metadata;

export default function TermsAndConditionsPage() {
  return <PolicyPage content={policyPages.terms} />;
}
