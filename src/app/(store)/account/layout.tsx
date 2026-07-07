import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Account",
  description: "Private Pour n Art customer account area.",
  path: "/account",
  noIndex: true,
});

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
