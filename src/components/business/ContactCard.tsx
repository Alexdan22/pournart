import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

type ContactCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  href: string;
  label: string;
  external?: boolean;
};

export function ContactCard({ icon, title, description, href, label, external = false }: ContactCardProps) {
  return (
    <a className="business-contact-card" href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
      <span className="business-card-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      <span className="business-contact-link">
        {label}
        <ArrowUpRight aria-hidden size={15} />
      </span>
    </a>
  );
}
