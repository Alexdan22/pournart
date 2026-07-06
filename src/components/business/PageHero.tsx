import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import type { BusinessAction } from "@/lib/business-content";
import { Reveal } from "@/components/business/Reveal";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  accentImageSrc?: string;
  actions?: BusinessAction[];
};

export function PageHero({ eyebrow, title, description, imageSrc, imageAlt, accentImageSrc, actions = [] }: PageHeroProps) {
  return (
    <section className="business-hero">
      <div className="business-hero-panel">
        <Reveal className="business-hero-copy">
          <span className="panel-label">
            <Sparkles aria-hidden size={16} />
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          {actions.length > 0 ? (
            <div className="business-actions">
              {actions.map((action, index) => (
                <Link
                  className={index === 0 ? "primary-button" : "secondary-button"}
                  href={action.href}
                  target={action.external ? "_blank" : undefined}
                  rel={action.external ? "noreferrer" : undefined}
                  key={action.href}
                >
                  <span>{action.label}</span>
                  {index === 0 ? <ArrowRight aria-hidden size={17} /> : null}
                </Link>
              ))}
            </div>
          ) : null}
        </Reveal>
        <Reveal className="business-hero-visual" delay={0.08}>
          <Image className="business-hero-image" src={imageSrc} alt={imageAlt} width={780} height={720} priority />
          {accentImageSrc ? (
            <Image className="business-hero-accent" src={accentImageSrc} alt="" width={260} height={260} />
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
