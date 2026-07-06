import type { ReactNode } from "react";
import { Reveal } from "@/components/business/Reveal";

type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function Section({ eyebrow, title, description, children, className = "", id }: SectionProps) {
  return (
    <section className={`business-section ${className}`.trim()} id={id}>
      <Reveal className="business-section-heading">
        {eyebrow ? <span className="panel-label">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </Reveal>
      <Reveal className="business-section-body" delay={0.08}>
        {children}
      </Reveal>
    </section>
  );
}
