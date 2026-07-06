import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function WishlistPage() {
  const session = await requireUser();
  const wishlistItems = await prisma.wishlistItem.findMany({
    where: { userId: session.id },
    include: { product: { include: { category: true } } },
    orderBy: { createdAt: "desc" },
  });
  const products = wishlistItems.map((item) => item.product).filter((product) => product.isActive);

  return (
    <section className="catalog-page wishlist-page">
      <div className="section-heading heading-row">
        <div>
          <span className="panel-label">Wishlist</span>
          <h1>Your loved pieces.</h1>
          <p>Save custom gifts and handcrafted pieces you want to revisit.</p>
        </div>
        <Link className="secondary-button" href="/products">
          Shop more <ArrowRight aria-hidden size={18} />
        </Link>
      </div>

      {products.length > 0 ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard product={product} isWishlisted wishlistReturnTo="/wishlist" key={product.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state soft-empty">
          <Heart aria-hidden size={34} />
          <h2>Your wishlist is waiting.</h2>
          <p>Tap the heart on any product to save it here.</p>
          <Link className="primary-button" href="/products">
            Explore gifts <ArrowRight aria-hidden size={18} />
          </Link>
        </div>
      )}
    </section>
  );
}
