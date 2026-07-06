import { CTA } from "@/components/business/CTA";
import { PageHero } from "@/components/business/PageHero";
import { PolicySection } from "@/components/business/PolicySection";
import type { PolicyContent } from "@/lib/business-content";

type PolicyPageProps = {
  content: PolicyContent;
};

export function PolicyPage({ content }: PolicyPageProps) {
  return (
    <>
      <PageHero
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
        imageSrc={content.imageSrc}
        imageAlt=""
        accentImageSrc="/assets/optimized/resin-coasters-blue-home.webp"
      />
      <section className="business-section business-policy-list" aria-label={content.eyebrow}>
        {content.sections.map((section, index) => (
          <PolicySection title={section.title} intro={section.intro} items={section.items} key={`${section.title}-${index}`} />
        ))}
      </section>
      <CTA
        eyebrow="Need help?"
        title="Have a question before you order?"
        description="Send the studio a quick note and we will help clarify timelines, custom details, or care before you choose."
        primaryAction={{ label: "Contact the studio", href: "/contact" }}
        secondaryAction={{ label: "Browse gifts", href: "/products" }}
      />
    </>
  );
}
