import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Orders",
  description: "Private Pour n Art order tracking area.",
  path: "/orders",
  noIndex: true,
});

export default function OrdersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
