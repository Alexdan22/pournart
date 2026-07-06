"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { FAQCategory } from "@/lib/business-content";
import { Reveal } from "@/components/business/Reveal";

type FAQAccordionProps = {
  categories: FAQCategory[];
};

export function FAQAccordion({ categories }: FAQAccordionProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedQuery) {
      return categories;
    }

    return categories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const haystack = `${category.title} ${item.question} ${item.answer}`.toLowerCase();

          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, normalizedQuery]);
  const matchCount = filteredCategories.reduce((total, category) => total + category.items.length, 0);

  return (
    <div className="business-faq">
      <Reveal className="business-faq-search-wrap">
        <label className="business-faq-search">
          <Search aria-hidden size={18} />
          <span>Search the studio guide</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ordering, custom gifts, shipping..."
            type="search"
          />
        </label>
      </Reveal>

      {filteredCategories.length > 0 ? (
        <div className="business-faq-categories">
          {filteredCategories.map((category, categoryIndex) => (
            <Reveal className="business-faq-category" delay={categoryIndex * 0.04} key={category.title}>
              <div className="business-faq-category-heading">
                <div>
                  <span className="panel-label">{category.title}</span>
                  <h2>{category.description}</h2>
                </div>
                <small>{category.items.length} answers</small>
              </div>
              <div className="business-faq-list">
                {category.items.map((item, index) => (
                  <details className="business-faq-item" open={!normalizedQuery && index === 0} key={item.question}>
                    <summary>
                      <span>{item.question}</span>
                      <ChevronDown className="business-faq-icon" aria-hidden size={18} />
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal className="business-faq-empty">
          <strong>No answers found.</strong>
          <p>Try a shorter word, or contact the studio for a personal reply.</p>
        </Reveal>
      )}

      {normalizedQuery ? <p className="business-faq-count">{matchCount} matching answers</p> : null}
    </div>
  );
}
