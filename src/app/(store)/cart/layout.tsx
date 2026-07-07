import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Cart",
  description: "Review selected Pour n Art products before checkout.",
  path: "/cart",
  noIndex: true,
});

export default function CartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
