import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CalendarHeart,
  Camera,
  Clock,
  Flower2,
  Gem,
  Gift,
  Grid3X3,
  Heart,
  Home as HomeIcon,
  MessageCircle,
  PackageCheck,
  Paintbrush,
  Search,
  Shell,
  Shirt,
  Sparkles,
  Truck,
  Waves,
} from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getActiveCategories, getFeaturedProducts } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { warmDisplayCopy } from "@/lib/product-positioning";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Handcrafted Custom Gifts & Resin Art",
  description:
    "Shop handmade resin art, personalized custom gifts, keepsakes, trays, coasters, name plates, and gift-ready decor from Pour n Art.",
  path: "/",
  image: "/assets/optimized/resin-hero-home.webp",
  keywords: ["resin gifts", "custom resin art", "personalized keepsakes", "handmade gifts"],
});

const occasions = [
  {
    title: "Birthday Gifts",
    description: "Personalized pieces that feel thoughtful, useful, and made for one person.",
    cta: "Explore Birthday Gifts →",
    href: "/products?q=birthday",
    imageUrl: "/assets/optimized/birthday-gifts-home.webp",
    icon: Gift,
  },
  {
    title: "Anniversary Gifts",
    description: "Names, dates, florals, and ocean tones preserved in personalized form.",
    cta: "Explore Anniversary Gifts →",
    href: "/products?q=anniversary",
    imageUrl: "/assets/optimized/anniversary-gifts-home.webp",
    icon: Heart,
  },
  {
    title: "Wedding Gifts",
    description: "Gift-ready ring platters, trays, and memory pieces for the big day.",
    cta: "Explore Wedding Gifts →",
    href: "/products?q=wedding",
    imageUrl: "/assets/optimized/wedding-gifts-home.webp",
    icon: CalendarHeart,
  },
  {
    title: "Housewarming Gifts",
    description: "Statement decor for entrances, coffee tables, and new corners.",
    cta: "Explore Housewarming Gifts →",
    href: "/products?q=housewarming",
    imageUrl: "/assets/optimized/housewarming-gifts-home.webp",
    icon: HomeIcon,
  },
  {
    title: "Personalized Pieces",
    description: "Custom pieces made around flowers, shells, initials, and memories.",
    cta: "Explore Personalized Pieces →",
    href: "/products?category=personalized-keepsakes",
    imageUrl: "/assets/optimized/personal-keepsakes-home.webp",
    icon: Gem,
  },
];

const homepageCollectionOrder = [
  "botanical-collection",
  "ocean-collection",
  "home-collection",
  "wearables",
  "personalized-keepsakes",
];

const collectionIcons = {
  "botanical-collection": Flower2,
  "ocean-collection": Waves,
  "home-collection": HomeIcon,
  wearables: Shirt,
  "personalized-keepsakes": Heart,
};

const valuePoints = [
  {
    title: "Handmade with Love",
    description: "Poured, arranged, finished, and packed by hand.",
    icon: Heart,
  },
  {
    title: "Custom Made Just for You",
    description: "Names, dates, colors, flowers, and details handled gently.",
    icon: Paintbrush,
  },
  {
    title: "Gift Ready Packaging",
    description: "Packed to feel thoughtful from the first look.",
    icon: PackageCheck,
  },
  {
    title: "Secure Shipping",
    description: "Protected carefully before it leaves the studio.",
    icon: Truck,
  },
];

const customOrderSteps = [
  {
    title: "Share Your Idea",
    description: "Tell us the occasion, names, colors, flowers, shells, or memory.",
    icon: Heart,
  },
  {
    title: "We Design It",
    description: "We confirm the piece, budget, timeline, and personal details.",
    icon: Paintbrush,
  },
  {
    title: "Handcrafted",
    description: "Your piece is made, packed, and prepared as a gift-ready piece.",
    icon: PackageCheck,
  },
];

export default async function Home() {
  const [banner, categories, featuredProducts] = await Promise.all([
    prisma.banner.findFirst({ where: { isActive: true }, orderBy: { updatedAt: "desc" } }),
    getActiveCategories(),
    getFeaturedProducts(),
  ]);

  const heroImage = banner?.imageUrl ?? "/assets/optimized/resin-hero-home.webp";
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const homepageCollections = homepageCollectionOrder.flatMap((slug) => {
    const category = categories.find((currentCategory) => currentCategory.slug === slug);
    return category ? [category] : [];
  });
  const quickCategories = [
    {
      label: "Best Sellers",
      href: "#best-sellers",
      imageUrl: "/assets/optimized/birthday-gifts-home.webp",
      badge: "Hot",
    },
    {
      label: "Custom Gifts",
      href: "#custom-gifts",
      imageUrl: "/assets/optimized/personal-keepsakes-home.webp",
    },
    {
      label: "Ocean Collection",
      href: "/products?category=ocean-collection",
      imageUrl: categoryBySlug.get("ocean-collection")?.imageUrl ?? "/assets/optimized/resin-coasters-blue-home.webp",
    },
    {
      label: "Home Decor",
      href: "/products?category=home-collection",
      imageUrl: categoryBySlug.get("home-collection")?.imageUrl ?? "/assets/optimized/resin-tray-home.webp",
    },
    {
      label: "Accessories",
      href: "/products?category=wearables",
      imageUrl: categoryBySlug.get("wearables")?.imageUrl ?? "/assets/optimized/personal-keepsakes-home.webp",
    },
    {
      label: "All Categories",
      href: "#shop-collections",
      icon: Grid3X3,
    },
  ];

  return (
    <>
      <section className="home-discovery" aria-label="Homepage shopping tools">
        <form className="home-search" action="/products">
          <Search aria-hidden size={19} />
          <input name="q" placeholder="Search gifts, collections, occasions..." />
          <Camera aria-hidden className="home-search-visual-icon" size={19} />
        </form>

        <nav className="quick-category-rail" aria-label="Quick categories">
          {quickCategories.map((item) => {
            const Icon = "icon" in item ? item.icon : undefined;

            return (
              <Link className="quick-category-item" href={item.href} key={item.label}>
                <span className="quick-category-image">
                  {"badge" in item ? <small>{item.badge}</small> : null}
                  {Icon ? (
                    <Icon aria-hidden size={24} />
                  ) : (
                    <Image
                      src={"imageUrl" in item && item.imageUrl ? item.imageUrl : "/assets/optimized/resin-hero-home.webp"}
                      alt=""
                      width={84}
                      height={84}
                    />
                  )}
                </span>
                <strong>{item.label}</strong>
              </Link>
            );
          })}
        </nav>
      </section>

      <section
        className="home-hero"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(255,250,243,0.97) 0%, rgba(255,250,243,0.82) 42%, rgba(255,250,243,0.1) 100%), url(${heroImage})`,
        }}
      >
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles aria-hidden size={17} />
            Pour n Art custom gifts
          </span>
          <h1>
            <span>Handcrafted gifts</span>
            <span>made for moments</span>
            <span>that matter.</span>
          </h1>
          <p>Personalized. Handcrafted. Made with heart.</p>
          <div className="hero-actions">
            <Link className="primary-button" href="#best-sellers">
              <span>Shop Now</span>
              <ArrowRight aria-hidden size={18} />
            </Link>
            <Link className="secondary-button" href="#custom-gifts">
              Create a Custom Piece
            </Link>
          </div>
        </div>
        <div className="hero-samples" aria-hidden="true">
          <div className="hero-sample hero-sample-small">
            <Image src="/assets/optimized/resin-coasters-blue-home.webp" alt="" width={260} height={260} priority />
          </div>
          <div className="hero-sample hero-sample-large">
            <Image src="/assets/optimized/resin-tray-home.webp" alt="" width={330} height={330} loading="eager" />
          </div>
          <div className="hero-sample hero-sample-accent">
            <Image src="/assets/optimized/resin-idol-home.webp" alt="" width={210} height={210} loading="lazy" />
          </div>
        </div>
      </section>

      <section className="page-section boutique-section" id="shop-occasions">
        <div className="home-section-head">
          <h2>Shop by Occasion</h2>
          <Link className="text-link" href="/products">
            View all <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
        <div className="occasion-rail">
          {occasions.map((occasion) => {
            const Icon = occasion.icon;

            return (
              <Link className="occasion-card" href={occasion.href} key={occasion.title}>
                <Image src={occasion.imageUrl} alt={occasion.title} width={520} height={420} />
                <strong>
                  <Icon aria-hidden size={18} />
                  {occasion.title}
                </strong>
                <span>Explore -&gt;</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="page-section boutique-section product-band" id="best-sellers">
        <div className="home-section-head">
          <h2>Best Sellers</h2>
          <Link className="text-link" href="/products">
            View all <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
        <div className="product-grid homepage-product-rail">
          {featuredProducts.map((product, index) => (
            <ProductCard
              product={product}
              badgeLabel={index === 0 || index === 3 ? "Bestseller" : undefined}
              wishlistReturnTo="/"
              key={product.id}
            />
          ))}
        </div>
      </section>

      <section className="page-section boutique-section compact-trust-section">
        <div className="home-trust-rail" aria-label="Why shop Pour n Art">
          {valuePoints.map((point) => {
            const Icon = point.icon;

            return (
              <article key={point.title}>
                <Icon aria-hidden size={22} />
                <strong>{point.title}</strong>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-section custom-process-section boutique-section">
        <div className="home-section-head custom-process-head">
          <div>
            <span className="panel-label">Custom piece</span>
            <h2>How your custom piece is made</h2>
          </div>
          <Link className="text-link" href="/contact">
            Know More <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
        <div className="custom-process-compact">
          {customOrderSteps.map((step, index) => {
            const Icon = step.icon;

            return (
              <article key={step.title}>
                <Icon aria-hidden size={22} />
                <h3>
                  {index + 1}. {step.title}
                </h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="page-section custom-gift-section boutique-section" id="custom-gifts">
        <div className="custom-gift-grid homepage-custom-card">
          <div className="custom-gift-copy">
            <span className="panel-label">Custom Gifts, Made Just for You</span>
            <h2>Preserve the detail that makes it yours.</h2>
            <p>
              Have flowers, shells, names, dates, initials, or a memory you want preserved? We can turn it into a
              handcrafted piece made just for you.
            </p>
            <div className="craft-notes">
              <span>
                <Shell aria-hidden size={18} />
                Ocean-inspired details
              </span>
              <span>
                <Flower2 aria-hidden size={18} />
                Botanical pieces
              </span>
              <span>
                <Gem aria-hidden size={18} />
                Made to order
              </span>
            </div>
          </div>
          <div className="custom-gift-action-card">
            <Sparkles aria-hidden size={24} />
            <strong>Have a flower, shell, name, date, or color story in mind?</strong>
            <p>Share the idea and we will help shape the product, budget, and timeline before making.</p>
            <Link className="primary-button" href="/contact">
              <MessageCircle aria-hidden size={18} />
              Start a custom request
            </Link>
          </div>
        </div>
      </section>

      <section className="page-section boutique-section" id="shop-collections">
        <div className="home-section-head">
          <h2>Shop by Collection</h2>
          <Link className="text-link" href="/products">
            View all <ArrowRight aria-hidden size={15} />
          </Link>
        </div>
        <div className="category-grid collection-rail">
          {homepageCollections.map((category) => {
            const Icon = collectionIcons[category.slug as keyof typeof collectionIcons] ?? Sparkles;

            return (
              <Link className="category-tile collection-tile" href={`/products?category=${category.slug}`} key={category.id}>
                <Image
                  src={category.imageUrl ?? "/assets/optimized/resin-hero-home.webp"}
                  alt={warmDisplayCopy(category.name)}
                  width={520}
                  height={420}
                />
                <span>
                  <Icon aria-hidden size={18} />
                  {warmDisplayCopy(category.name)}
                </span>
                <small>{warmDisplayCopy(category.description)}</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="page-section care-craft-section">
        <div className="section-heading">
          <span className="panel-label">Care & craft</span>
          <h2>Made by hand, cared for with ease.</h2>
        </div>
        <div className="care-craft-grid">
          <article>
            <Sparkles aria-hidden size={22} />
            <h3>Natural handmade variation</h3>
            <p>Every pour has small shifts in color, texture, bubbles, and placement, making each piece one of one.</p>
          </article>
          <article>
            <Gem aria-hidden size={22} />
            <h3>Simple everyday care</h3>
            <p>Wipe gently with a soft damp cloth, keep away from harsh heat, and avoid abrasive cleaners.</p>
          </article>
          <article>
            <Clock aria-hidden size={22} />
            <h3>Thoughtful making time</h3>
            <p>Most pieces are made in 3-18 days depending on size, detail, personalization, and curing time.</p>
          </article>
        </div>
      </section>
    </>
  );
}
