import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/money";

type ProductCardProps = {
  product: {
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
};

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <Link href={`/products/${product.slug}`} className="product-image-wrap">
        <Image
          src={product.imageUrl}
          alt={product.name}
          width={720}
          height={720}
          className="product-image"
        />
      </Link>
      <div className="product-card-body">
        <div className="product-eyebrow">
          <Sparkles aria-hidden size={15} />
          {product.category.name}
        </div>
        <Link href={`/products/${product.slug}`} className="product-title">
          {product.name}
        </Link>
        <p>{product.description}</p>
        <div className="product-meta-row">
          <span className="price">{formatINR(product.price)}</span>
          {product.compareAtPrice ? <span className="compare-price">{formatINR(product.compareAtPrice)}</span> : null}
        </div>
        <div className="product-timeline">
          <Clock aria-hidden size={15} />
          {product.handmadeDaysMin}-{product.handmadeDaysMax} days handmade
        </div>
      </div>
    </article>
  );
}
