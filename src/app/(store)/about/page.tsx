import type { Metadata } from "next";
import { Flower2, Gem, Heart, PackageCheck, Paintbrush, Sparkles, Waves } from "lucide-react";
import { CTA, InfoCard, PageHero, Section } from "@/components/business";
import { aboutStoryBlocks, businessMetadata, creationSteps, whyChoosePoints } from "@/lib/business-content";

export const metadata: Metadata = businessMetadata.about;

const philosophyCards = [
  {
    title: "Softly personal",
    description: "Names, colors, and small details are treated as the heart of the piece.",
    icon: <Heart aria-hidden size={21} />,
  },
  {
    title: "Nature led",
    description: "Flowers, shells, ocean tones, and gentle textures guide the studio mood.",
    icon: <Flower2 aria-hidden size={21} />,
  },
  {
    title: "Slow finish",
    description: "Each layer gets time to cure so the final piece feels polished and lasting.",
    icon: <Sparkles aria-hidden size={21} />,
  },
];

const whyIcons = [Gem, PackageCheck, Waves, Paintbrush];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Pour n Art"
        title="A boutique studio for gifts with memory in them."
        description="We create handcrafted custom gifts and keepsakes with a soft resin finish, natural detail, and a made-for-you feeling."
        imageSrc="/assets/optimized/resin-hero-home.webp"
        imageAlt="Handcrafted Pour n Art resin gifts"
        accentImageSrc="/assets/optimized/resin-idol-home.webp"
        actions={[
          { label: "Start a custom piece", href: "/contact" },
          { label: "Shop collections", href: "/products" },
        ]}
      />

      <Section
        eyebrow={aboutStoryBlocks[0].eyebrow}
        title={aboutStoryBlocks[0].title}
        description={aboutStoryBlocks[0].description}
        className="business-story-section"
      >
        <div className="business-wide-card">
          <p>
            Placeholder studio copy for a warm origin story, kept short for now while the final brand story is written.
          </p>
        </div>
      </Section>

      <Section
        eyebrow={aboutStoryBlocks[1].eyebrow}
        title={aboutStoryBlocks[1].title}
        description={aboutStoryBlocks[1].description}
      >
        <div className="business-card-grid business-card-grid-three">
          {philosophyCards.map((card) => (
            <InfoCard title={card.title} description={card.description} icon={card.icon} key={card.title} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow={aboutStoryBlocks[2].eyebrow}
        title={aboutStoryBlocks[2].title}
        description={aboutStoryBlocks[2].description}
      >
        <div className="business-process-list">
          {creationSteps.map((step, index) => (
            <article className="business-process-step" key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Why Choose Pour n Art"
        title="Handmade warmth, polished for gifting."
        description="A small studio approach keeps every order thoughtful, personal, and carefully finished."
      >
        <div className="business-card-grid business-card-grid-four">
          {whyChoosePoints.map((point, index) => {
            const Icon = whyIcons[index] ?? Sparkles;

            return (
              <InfoCard
                title={point.title}
                description={point.description}
                icon={<Icon aria-hidden size={21} />}
                key={point.title}
              />
            );
          })}
        </div>
      </Section>

      <CTA
        title="Have a memory you want made into a gift?"
        description="Share the occasion, colors, names, or keepsake detail and the studio will help shape a custom piece."
        primaryAction={{ label: "Start a custom request", href: "/contact" }}
        secondaryAction={{ label: "Browse products", href: "/products" }}
      />
    </>
  );
}
