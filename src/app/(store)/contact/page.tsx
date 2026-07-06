import type { Metadata } from "next";
import { Clock, Mail, MessageCircle } from "lucide-react";
import { ContactCard, CTA, InfoCard, PageHero, Section } from "@/components/business";
import { CustomOrderForm } from "@/components/custom-order-form";
import { InstagramMark } from "@/components/instagram-mark";
import { businessHours, businessMetadata } from "@/lib/business-content";
import { defaultWhatsAppMessage } from "@/lib/constants";

export const metadata: Metadata = businessMetadata.contact;

export default function ContactPage() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultWhatsAppMessage)}`
    : "mailto:pournart@gmail.com";

  return (
    <>
      <PageHero
        eyebrow="Contact the studio"
        title="Create a handcrafted piece around your memory."
        description="Share the occasion, details, budget, and any names, dates, florals, shells, or colors you want preserved."
        imageSrc="/assets/optimized/personal-keepsakes-home.webp"
        imageAlt="Personalized handcrafted Pour n Art keepsake"
        accentImageSrc="/assets/optimized/resin-coasters-blue-home.webp"
        actions={[
          { label: "Start request", href: "#custom-request" },
          { label: "Read FAQ", href: "/faq" },
        ]}
      />

      <Section
        eyebrow="Quick Links"
        title="Reach us where it feels easiest."
        description="Use a short message to begin. The studio will guide the next step."
      >
        <div className="business-card-grid business-card-grid-three">
          <ContactCard
            icon={<Mail aria-hidden size={20} />}
            title="Email"
            description="Best for order notes, policy questions, and detailed custom ideas."
            href="mailto:pournart@gmail.com"
            label="pournart@gmail.com"
          />
          <ContactCard
            icon={<MessageCircle aria-hidden size={20} />}
            title="WhatsApp"
            description="Best for quick custom gift conversations and timeline checks."
            href={whatsappHref}
            label="Start chat"
            external={whatsappHref.startsWith("https://")}
          />
          <ContactCard
            icon={<InstagramMark aria-hidden size={20} />}
            title="Instagram"
            description="Best for browsing recent work and sending a visual reference."
            href="https://www.instagram.com/pour_n_art/"
            label="@pour_n_art"
            external
          />
        </div>
      </Section>

      <Section
        eyebrow="Custom Order Form"
        title="Tell us the shape of the gift."
        description="The existing enquiry flow saves your request and continues to WhatsApp or email after submission."
        className="business-contact-form-section"
        id="custom-request"
      >
        <div className="business-contact-layout">
          <CustomOrderForm whatsappNumber={whatsappNumber} />
          <aside className="business-hours-card">
            <span className="business-card-icon">
              <Clock aria-hidden size={21} />
            </span>
            <h3>Business Hours</h3>
            <p>Placeholder availability for custom gift conversations and order support.</p>
            <dl>
              {businessHours.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </Section>

      <Section
        eyebrow="Before You Send"
        title="A few details help us respond well."
        description="You do not need a perfect brief. A mood, occasion, and timeline are enough to begin."
      >
        <div className="business-card-grid business-card-grid-three">
          <InfoCard title="Occasion" description="Birthday, wedding, housewarming, anniversary, or a personal keepsake." />
          <InfoCard title="Personal detail" description="Names, initials, dates, colors, flowers, shells, or a reference mood." />
          <InfoCard title="Timeline" description="Share when you need the piece so we can guide what is possible." />
        </div>
      </Section>

      <CTA
        title="Still choosing the right gift?"
        description="Browse ready-to-gift pieces or send us a note and we will help narrow the idea."
        primaryAction={{ label: "Start a custom request", href: "#custom-request" }}
        secondaryAction={{ label: "Shop collections", href: "/products" }}
      />
    </>
  );
}
