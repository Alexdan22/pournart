import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gem, MessageSquareText, Sparkles, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getActiveCategories, getFeaturedProducts } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export default async function Home() {
  const [banner, categories, featuredProducts] = await Promise.all([
    prisma.banner.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } }),
    getActiveCategories(),
    getFeaturedProducts(),
  ]);

  const heroImage = banner?.imageUrl ?? "/assets/resin-hero.png";

  return (
    <>
      <section
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(255,250,243,0.97) 0%, rgba(255,250,243,0.82) 42%, rgba(255,250,243,0.1) 100%), url(${heroImage})`,
        }}
      >
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles aria-hidden size={17} />
            Handmade resin gifting across India
          </span>
          <h1>
            Pour <em>n</em> Art
          </h1>
          <p>
            {banner?.subtitle ??
              "Premium coasters, name plates, trays, devotional keepsakes, and one-off custom orders made with preserved details, ocean hues, and soft gold finishes."}
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href={banner?.ctaHref ?? "/products"}>
              <span>{banner?.ctaLabel ?? "Explore the collection"}</span>
              <ArrowRight aria-hidden size={18} />
            </Link>
            <Link className="secondary-button" href="/contact">
              Discuss custom order
            </Link>
          </div>
        </div>
        <div className="hero-samples" aria-hidden="true">
          <div className="hero-sample hero-sample-small">
            <Image src="/assets/resin-coasters-blue.png" alt="" width={260} height={260} priority />
          </div>
          <div className="hero-sample hero-sample-large">
            <Image src="/assets/resin-tray.png" alt="" width={330} height={330} priority />
          </div>
          <div className="hero-sample hero-sample-accent">
            <Image src="/assets/resin-idol.png" alt="" width={210} height={210} priority />
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Store highlights">
        <div>
          <span className="trust-icon">
            <Gem aria-hidden size={22} />
          </span>
          <span className="trust-copy">
            <strong>One-of-one resin pours</strong>
            <small>Hand mixed, arranged, and finished in small studio batches.</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <MessageSquareText aria-hidden size={22} />
          </span>
          <span className="trust-copy">
            <strong>Personal notes, names, dates</strong>
            <small>Every custom detail is captured before the piece is made.</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Truck aria-hidden size={22} />
          </span>
          <span className="trust-copy">
            <strong>Gift packed, tracked delivery</strong>
            <small>Making updates first, courier tracking after dispatch.</small>
          </span>
        </div>
      </section>

      <section className="page-section">
        <div className="section-heading">
          <span className="panel-label">Shop by craft type</span>
          <h2>Personalized resin pieces without the template-store feel.</h2>
        </div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-tile" href={`/products?category=${category.slug}`} key={category.id}>
              <Image
                src={category.imageUrl ?? "/assets/resin-hero.png"}
                alt={category.name}
                width={520}
                height={420}
              />
              <span>{category.name}</span>
              <small>{category.description}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="page-section product-band">
        <div className="section-heading heading-row">
          <div>
            <span className="panel-label">Featured products</span>
            <h2>Ready for custom notes, colors, and gifting timelines.</h2>
          </div>
          <Link className="text-link" href="/products">
            View all <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
        <div className="product-grid">
          {featuredProducts.map((product) => (
            <ProductCard product={product} key={product.id} />
          ))}
        </div>
      </section>
    </>
  );
}
