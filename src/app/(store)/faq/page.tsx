import type { Metadata } from "next";
import { CTA, FAQAccordion, PageHero } from "@/components/business";
import { businessMetadata, faqCategories } from "@/lib/business-content";

export const metadata: Metadata = businessMetadata.faq;

export default function FAQPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Helpful answers before your piece is made."
        description="Search concise guidance about ordering, custom gifts, shipping, returns, and caring for handmade pieces."
        imageSrc="/assets/optimized/resin-coasters-blue-home.webp"
        imageAlt="Blue handcrafted resin coaster set"
        accentImageSrc="/assets/optimized/resin-nameplate-card.webp"
        actions={[
          { label: "Ask the studio", href: "/contact" },
          { label: "Shop gifts", href: "/products" },
        ]}
      />
      <section className="business-section business-faq-section" aria-label="Frequently asked questions">
        <FAQAccordion categories={faqCategories} />
      </section>
      <CTA
        title="Could not find the answer?"
        description="Send a short note with your product, timeline, or custom idea and the studio will reply personally."
        primaryAction={{ label: "Contact the studio", href: "/contact" }}
        secondaryAction={{ label: "Browse products", href: "/products" }}
      />
    </>
  );
}
