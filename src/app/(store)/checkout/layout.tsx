import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Checkout",
  description: "Secure Pour n Art checkout for handcrafted custom gifts.",
  path: "/checkout",
  noIndex: true,
});

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
