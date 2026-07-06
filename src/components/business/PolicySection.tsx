import { CheckCircle2 } from "lucide-react";

type PolicySectionProps = {
  title: string;
  intro: string;
  items: string[];
};

export function PolicySection({ title, intro, items }: PolicySectionProps) {
  return (
    <article className="business-policy-card">
      <h2>{title}</h2>
      <p>{intro}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <CheckCircle2 aria-hidden size={17} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
