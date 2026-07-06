import type { ReactNode } from "react";

type InfoCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
};

export function InfoCard({ eyebrow, title, description, icon }: InfoCardProps) {
  return (
    <article className="business-info-card">
      {icon ? <span className="business-card-icon">{icon}</span> : null}
      {eyebrow ? <span className="business-card-eyebrow">{eyebrow}</span> : null}
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}
