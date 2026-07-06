import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import type { BusinessAction } from "@/lib/business-content";
import { Reveal } from "@/components/business/Reveal";

type CTAProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction: BusinessAction;
  secondaryAction?: BusinessAction;
};

export function CTA({ eyebrow = "Studio note", title, description, primaryAction, secondaryAction }: CTAProps) {
  return (
    <section className="business-section business-cta-section" aria-label="Next step">
      <Reveal className="business-cta">
        <div>
          <span className="panel-label">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="business-actions">
          <Link
            className="primary-button"
            href={primaryAction.href}
            target={primaryAction.external ? "_blank" : undefined}
            rel={primaryAction.external ? "noreferrer" : undefined}
          >
            <MessageCircle aria-hidden size={18} />
            <span>{primaryAction.label}</span>
          </Link>
          {secondaryAction ? (
            <Link
              className="secondary-button"
              href={secondaryAction.href}
              target={secondaryAction.external ? "_blank" : undefined}
              rel={secondaryAction.external ? "noreferrer" : undefined}
            >
              <span>{secondaryAction.label}</span>
              <ArrowRight aria-hidden size={16} />
            </Link>
          ) : null}
        </div>
      </Reveal>
    </section>
  );
}
