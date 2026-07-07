import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Camera, Grid3X3, Search, ShoppingBag } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getActiveCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { warmDisplayCopy } from "@/lib/product-positioning";
import { createMetadata } from "@/lib/seo";
import { getSession } from "@/lib/session";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export async function generateMetadata({ searchParams }: ProductsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const query = params.q?.trim();

  if (query) {
    return createMetadata({
      title: `Search results for ${query}`,
      description: `Browse Pour n Art handmade gift search results for ${query}.`,
      path: `/products?q=${encodeURIComponent(query)}`,
      noIndex: true,
    });
  }

  if (params.category) {
    const category = await prisma.category.findFirst({
      where: { slug: params.category, isActive: true },
      select: { name: true, description: true, imageUrl: true, slug: true, metaTitle: true, metaDescription: true },
    });

    if (category) {
      return createMetadata({
        title: category.metaTitle || `${warmDisplayCopy(category.name)} Collection`,
        description: category.metaDescription || category.description,
        path: `/products?category=${category.slug}`,
        image: category.imageUrl || "/assets/optimized/resin-hero-home.webp",
        keywords: [category.name, warmDisplayCopy(category.name), "custom gifts"],
      });
    }
  }

  return createMetadata({
    title: "Shop Handcrafted Custom Gifts",
    description: "Browse Pour n Art handmade resin gifts, personalized keepsakes, trays, coasters, decor, and custom gift collections.",
    path: "/products",
    image: "/assets/optimized/resin-coasters-card.webp",
    keywords: ["shop custom gifts", "resin art products", "personalized gifts"],
  });
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;
  const session = await getSession();
  const categories = await getActiveCategories();
  const selectedCategory = params.category;
  const query = params.q?.trim();
  const [products, wishlistItems] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        category: selectedCategory ? { slug: selectedCategory } : undefined,
        OR: query
          ? [
              { name: { contains: query } },
              { description: { contains: query } },
              { story: { contains: query } },
            ]
          : undefined,
      },
      include: { category: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
    }),
    session
      ? prisma.wishlistItem.findMany({
          where: { userId: session.id },
          select: { productId: true },
        })
      : Promise.resolve([]),
  ]);
  const wishlistProductIds = new Set(wishlistItems.map((item) => item.productId));

  return (
    <section className="catalog-page">
      <div className="section-heading catalog-heading">
        <span className="panel-label">Shop</span>
        <h1>Find a handcrafted gift for the moment.</h1>
      </div>

      <form className="catalog-filter" action="/products">
        <label>
          <Search aria-hidden size={18} />
          <input name="q" defaultValue={query} placeholder="Search gifts, collections, occasions..." />
          <Camera aria-hidden className="home-search-visual-icon" size={18} />
        </label>
        <select name="category" defaultValue={selectedCategory ?? ""}>
          <option value="">All collections</option>
          {categories.map((category) => (
            <option value={category.slug} key={category.id}>
              {warmDisplayCopy(category.name)}
            </option>
          ))}
        </select>
        <button className="secondary-button" type="submit">
          Filter
        </button>
        {selectedCategory || query ? (
          <Link className="text-link" href="/products">
            Clear
          </Link>
        ) : null}
      </form>

      <nav className="catalog-category-rail" aria-label="Shop categories">
        <Link className={!selectedCategory ? "catalog-category-pill active" : "catalog-category-pill"} href="/products">
          <span>
            <Grid3X3 aria-hidden size={22} />
          </span>
          All
        </Link>
        {categories.map((category) => (
          <Link
            className={selectedCategory === category.slug ? "catalog-category-pill active" : "catalog-category-pill"}
            href={`/products?category=${category.slug}`}
            key={category.id}
          >
            <span>
              {category.imageUrl ? (
                <Image src={category.imageUrl} alt="" width={56} height={56} />
              ) : (
                <Grid3X3 aria-hidden size={22} />
              )}
            </span>
            {warmDisplayCopy(category.name)}
          </Link>
        ))}
      </nav>

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            product={product}
            isWishlisted={wishlistProductIds.has(product.id)}
            wishlistReturnTo="/products"
            key={product.id}
          />
        ))}
      </div>
      {products.length === 0 ? (
        <div className="empty-state soft-empty">
          <ShoppingBag aria-hidden size={34} />
          <h2>No pieces found.</h2>
          <p>Try another collection or send the studio a custom gift idea.</p>
          <Link className="primary-button" href="/contact">
            Start a custom request
          </Link>
        </div>
      ) : null}
    </section>
  );
}
