import type { Metadata } from "next";
import { Cormorant_Garamond, Geist_Mono, Manrope } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pour n Art | Handcrafted Custom Gifts",
  description:
    "Premium handmade custom gifts, personalized pieces, statement decor, and made-to-order pieces inspired by memories, nature, and the ocean.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body>
        <CartProvider>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
          <MobileBottomNav />
        </CartProvider>
      </body>
    </html>
  );
}
