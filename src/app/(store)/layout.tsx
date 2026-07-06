import { CartProvider } from "@/components/cart-provider";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </CartProvider>
  );
}
