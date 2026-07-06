import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  Heart,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { ProductCard } from "@/components/product-card";
import { getProductBySlug, parseCustomizationFields } from "@/lib/catalog";
import { defaultWhatsAppMessage } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { getProductValueLabel, warmDisplayCopy } from "@/lib/product-positioning";

export default async function ProductDetailPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isActive) {
    notFound();
  }

  const customizationFields = parseCustomizationFields(product.customizationFields);
  const valueLabel = getProductValueLabel(product);
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const displayName = warmDisplayCopy(product.name);
  const displayDescription = warmDisplayCopy(product.description);
  const displayStory = warmDisplayCopy(product.story);
  const whatsappMessage = `${defaultWhatsAppMessage}\nProduct: ${displayName}`;
  const whatsappHref = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
    : null;
  const [relatedProducts, approvedReviews] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        categoryId: product.categoryId,
        NOT: { id: product.id },
      },
      include: { category: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    prisma.review.findMany({
      where: { productId: product.id, status: "APPROVED" },
      include: { user: { select: { name: true } } },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
  ]);
  const lovePoints = [
    {
      title: "Handmade from start to finish",
      description: "Every piece is poured, arranged, finished, and checked by hand.",
      icon: Heart,
    },
    {
      title: "Naturally one of a kind",
      description: "Small shifts in color, texture, and placement make each item unique.",
      icon: Sparkles,
    },
    {
      title: "Made in small batches",
      description: "Thoughtful studio batches keep the finish personal, careful, and refined.",
      icon: PackageCheck,
    },
    {
      title: "Ready for meaningful gifting",
      description: "Designed for birthdays, anniversaries, weddings, new homes, and personal moments.",
      icon: Gift,
    },
  ];
  const includedItems = [
    { label: "Handmade product", icon: Sparkles },
    { label: "Gift-ready packaging", icon: Gift },
    { label: "Care guide", icon: Heart },
    { label: "Secure protective packaging", icon: ShieldCheck },
    { label: "Tracking after dispatch", icon: Truck },
  ];
  const timelineSteps = [
    { title: "Order Confirmed", detail: "Payment and order details are received." },
    { title: "Handcrafted", detail: `${product.handmadeDaysMin}-${product.handmadeDaysMax} days depending on detail and curing time.` },
    { title: "Packed", detail: "Prepared carefully with protective, gift-ready packaging." },
    { title: "Dispatched", detail: "Tracking details are shared after dispatch." },
    { title: "Delivered", detail: "Your handcrafted piece reaches its new home." },
  ];
  const careGuide = [
    "Clean with a soft cloth",
    "Avoid prolonged direct sunlight",
    "Avoid abrasive chemicals",
    "Handmade variations are natural",
  ];
  const faqs = [
    {
      question: "Is every piece unique?",
      answer: "Yes. Each piece is handmade, so small variations in color, texture, bubbles, and placement are natural.",
    },
    {
      question: "Can I personalize it?",
      answer: "Most products can include names, dates, initials, colors, florals, shells, or small personal details.",
    },
    {
      question: "How long does crafting take?",
      answer: `This product usually takes ${product.handmadeDaysMin}-${product.handmadeDaysMax} days before packing, depending on detail and curing time.`,
    },
    {
      question: "Is gift packaging included?",
      answer: "Yes. Each order is prepared with gift-ready packaging and secure protection for delivery.",
    },
    {
      question: "What if my order is damaged?",
      answer: "Share photos as soon as it arrives, and the team will help review the issue and next steps.",
    },
    {
      question: "Can I request a completely custom design?",
      answer: "Yes. Use the WhatsApp inquiry option or the custom gifts page to share your idea, budget, and timeline.",
    },
  ];

  return (
    <section className="product-detail">
      <AnalyticsBeacon event="PRODUCT_VIEWED" productId={product.id} metadata={{ slug: product.slug }} />
      <Link className="text-link" href="/products">
        <ArrowLeft aria-hidden size={16} /> Back to collections
      </Link>

      <div className="product-detail-grid">
        <div className="detail-image-shell">
          <Image
            src={product.imageUrl}
            alt={displayName}
            width={980}
            height={980}
            className="detail-image"
            priority
          />
        </div>

        <div className="detail-copy">
          <span className="panel-label">{warmDisplayCopy(product.category.name)}</span>
          <h1>{displayName}</h1>
          <p>{displayDescription}</p>
          <div className="detail-price-row">
            <strong>{formatINR(product.price)}</strong>
            {product.compareAtPrice ? <span>{formatINR(product.compareAtPrice)}</span> : null}
            <small className="product-value-label">{valueLabel}</small>
          </div>
          <p className="product-intro">
            Made by hand with careful finishing, gift-ready packaging, and natural one-of-a-kind details.
          </p>
          <p className="story-copy">{displayStory}</p>

          <AddToCartForm product={product} customizationFields={customizationFields} />
          {whatsappHref ? (
            <a className="secondary-button product-whatsapp-button" href={whatsappHref} target="_blank" rel="noreferrer">
              <MessageCircle aria-hidden size={18} />
              Ask about customization
            </a>
          ) : null}
        </div>
      </div>

      <section className="product-info-section product-love-section" aria-label="Why you will love it">
        <div className="product-info-heading">
          <span className="panel-label">Why You&apos;ll Love It</span>
          <h2>Handmade value, thoughtful finish.</h2>
        </div>
        <div className="product-info-grid">
          {lovePoints.map((block) => {
            const Icon = block.icon;

            return (
              <article className="product-info-card" key={block.title}>
                <Icon aria-hidden size={21} />
                <h3>{block.title}</h3>
                <p>{block.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="product-detail-support">
        <article className="product-support-card product-included-card">
          <span className="panel-label">What&apos;s Included</span>
          <h2>Everything prepared for a smooth gifting experience.</h2>
          <div className="included-grid">
            {includedItems.map((item) => {
              const Icon = item.icon;

              return (
                <span key={item.label}>
                  <Icon aria-hidden size={18} />
                  {item.label}
                </span>
              );
            })}
          </div>
        </article>

        <article className="product-support-card product-care-card">
          <span className="panel-label">Care Guide</span>
          <h2>Simple care for a lasting finish.</h2>
          <ul>
            {careGuide.map((item) => (
              <li key={item}>
                <CheckCircle2 aria-hidden size={17} />
                {item}
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="product-info-section crafting-timeline-section" aria-label="Crafting timeline">
        <div className="product-info-heading">
          <span className="panel-label">Crafting Timeline</span>
          <h2>From confirmed order to delivery.</h2>
        </div>
        <div className="crafting-timeline">
          {timelineSteps.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-faq-section" aria-label="Product questions">
        <div className="product-info-heading">
          <span className="panel-label">Questions</span>
          <h2>Helpful answers before you order.</h2>
        </div>
        <div className="product-faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {approvedReviews.length > 0 ? (
        <section className="product-info-section product-review-section" aria-label="Customer reviews">
          <div className="product-info-heading">
            <span className="panel-label">Reviews</span>
            <h2>What customers shared after delivery.</h2>
          </div>
          <div className="review-grid">
            {approvedReviews.map((review) => (
              <article className={review.isFeatured ? "review-card featured" : "review-card"} key={review.id}>
                <span>
                  {Array.from({ length: review.rating }).map((_, index) => (
                    <Star aria-hidden fill="currentColor" size={14} key={index} />
                  ))}
                </span>
                <h3>{review.title || "Handcrafted with care"}</h3>
                <p>{review.body}</p>
                {review.reply ? <small>Studio reply: {review.reply}</small> : null}
                <strong>{review.user.name}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {relatedProducts.length > 0 ? (
        <section className="product-related-section">
          <div className="section-heading heading-row">
            <div>
              <span className="panel-label">You Might Also Love</span>
              <h2>More from this collection.</h2>
            </div>
            <Link className="text-link" href={`/products?category=${product.category.slug}`}>
              View collection
            </Link>
          </div>
          <div className="product-grid related-product-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard product={relatedProduct} key={relatedProduct.id} />
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
