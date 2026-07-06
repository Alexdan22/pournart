import Image from "next/image";
import Link from "next/link";
import { Clock, Heart, Sparkles } from "lucide-react";
import { toggleWishlistAction } from "@/app/actions/wishlist";
import { formatINR } from "@/lib/money";
import { getProductValueLabel, warmDisplayCopy } from "@/lib/product-positioning";

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    price: number;
    compareAtPrice: number | null;
    imageUrl: string;
    handmadeDaysMin: number;
    handmadeDaysMax: number;
    category: { name: string };
  };
  badgeLabel?: string;
  isWishlisted?: boolean;
  wishlistReturnTo?: string;
};

const optimizedProductImages: Record<string, string> = {
  "/assets/resin-coasters-blue.png": "/assets/optimized/resin-coasters-blue-home.webp",
  "/assets/resin-coasters.png": "/assets/optimized/resin-coasters-card.webp",
  "/assets/resin-tray.png": "/assets/optimized/resin-tray-home.webp",
  "/assets/resin-idol.png": "/assets/optimized/resin-idol-home.webp",
  "/assets/resin-nameplate.png": "/assets/optimized/resin-nameplate-card.webp",
};

export function ProductCard({ product, badgeLabel, isWishlisted = false, wishlistReturnTo = "/products" }: ProductCardProps) {
  const valueLabel = getProductValueLabel(product);
  const displayBadge = badgeLabel ?? valueLabel;
  const displayName = warmDisplayCopy(product.name);
  const imageUrl = optimizedProductImages[product.imageUrl] ?? product.imageUrl;

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link href={`/products/${product.slug}`} className="product-image-link">
          <Image src={imageUrl} alt={displayName} width={720} height={720} className="product-image" />
        </Link>
        <span className="product-card-badge">{displayBadge}</span>
        <form className="product-wishlist-form" action={toggleWishlistAction}>
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="returnTo" value={wishlistReturnTo} />
          <button
            className={isWishlisted ? "product-wishlist-button active" : "product-wishlist-button"}
            type="submit"
            aria-label={isWishlisted ? `Remove ${displayName} from wishlist` : `Add ${displayName} to wishlist`}
            aria-pressed={isWishlisted}
          >
            <Heart aria-hidden size={17} />
          </button>
        </form>
      </div>
      <div className="product-card-body">
        <div className="product-eyebrow">
          <Sparkles aria-hidden size={15} />
          {warmDisplayCopy(product.category.name)}
        </div>
        <Link href={`/products/${product.slug}`} className="product-title">
          {displayName}
        </Link>
        <p>{warmDisplayCopy(product.description)}</p>
        <div className="product-meta-row">
          <span className="price-stack">
            <span className="price">{formatINR(product.price)}</span>
            {product.compareAtPrice ? <span className="compare-price">{formatINR(product.compareAtPrice)}</span> : null}
          </span>
        </div>
        <div className="product-card-footer">
          <div className="product-timeline">
            <Clock aria-hidden size={15} />
            {product.handmadeDaysMin}-{product.handmadeDaysMax} days handmade
          </div>
          <div className="product-trust-text">
            <Sparkles aria-hidden size={13} />
            Handmade
          </div>
          <Link className="product-detail-link" href={`/products/${product.slug}`}>
            View details
          </Link>
        </div>
      </div>
    </article>
  );
}
