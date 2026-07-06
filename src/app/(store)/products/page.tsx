import Image from "next/image";
import Link from "next/link";
import { Camera, Grid3X3, Search } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getActiveCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { warmDisplayCopy } from "@/lib/product-positioning";
import { getSession } from "@/lib/session";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
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
    </section>
  );
}
