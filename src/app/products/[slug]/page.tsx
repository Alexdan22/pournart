import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, PackageCheck, Truck } from "lucide-react";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { getProductBySlug, parseCustomizationFields } from "@/lib/catalog";
import { formatINR } from "@/lib/money";

export default async function ProductDetailPage(props: PageProps<"/products/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product || !product.isActive) {
    notFound();
  }

  const customizationFields = parseCustomizationFields(product.customizationFields);

  return (
    <section className="product-detail">
      <Link className="text-link" href="/products">
        <ArrowLeft aria-hidden size={16} /> Back to products
      </Link>

      <div className="product-detail-grid">
        <div className="detail-image-shell">
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={980}
            height={980}
            className="detail-image"
            priority
          />
        </div>

        <div className="detail-copy">
          <span className="panel-label">{product.category.name}</span>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="detail-price-row">
            <strong>{formatINR(product.price)}</strong>
            {product.compareAtPrice ? <span>{formatINR(product.compareAtPrice)}</span> : null}
          </div>
          <p className="story-copy">{product.story}</p>

          <div className="detail-promises">
            <div>
              <Clock aria-hidden size={20} />
              <span>
                {product.handmadeDaysMin}-{product.handmadeDaysMax} days handmade
              </span>
            </div>
            <div>
              <Truck aria-hidden size={20} />
              <span>India-wide delivery</span>
            </div>
            <div>
              <PackageCheck aria-hidden size={20} />
              <span>Tracked after dispatch</span>
            </div>
          </div>

          <AddToCartForm product={product} customizationFields={customizationFields} />
        </div>
      </div>
    </section>
  );
}
