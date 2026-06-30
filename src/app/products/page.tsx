import Link from "next/link";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { getActiveCategories } from "@/lib/catalog";
import { prisma } from "@/lib/db";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const categories = await getActiveCategories();
  const selectedCategory = params.category;
  const query = params.q?.trim();
  const products = await prisma.product.findMany({
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
  });

  return (
    <section className="catalog-page">
      <div className="section-heading">
        <span className="panel-label">Catalog</span>
        <h1>Handmade resin art for gifting, homes, and custom moments.</h1>
      </div>

      <form className="catalog-filter" action="/products">
        <label>
          <Search aria-hidden size={18} />
          <input name="q" defaultValue={query} placeholder="Search coasters, trays, name plates" />
        </label>
        <select name="category" defaultValue={selectedCategory ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option value={category.slug} key={category.id}>
              {category.name}
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

      <div className="product-grid">
        {products.map((product) => (
          <ProductCard product={product} key={product.id} />
        ))}
      </div>
    </section>
  );
}
