import { CartProvider } from "@/components/cart-provider";
import { JsonLd } from "@/components/json-ld";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export default function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <CartProvider>
      <JsonLd
        id="store-structured-data"
        data={{
          "@context": "https://schema.org",
          "@graph": [organizationJsonLd(), websiteJsonLd()],
        }}
      />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
      <MobileBottomNav />
    </CartProvider>
  );
}
