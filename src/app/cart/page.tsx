"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatINR } from "@/lib/money";

export default function CartPage() {
  const { items, subtotal, getItemKey, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <section className="empty-state">
        <ShoppingBag aria-hidden size={36} />
        <h1>Your cart is empty.</h1>
        <p>Choose a resin piece and add your customization notes.</p>
        <Link className="primary-button" href="/products">
          Shop products <ArrowRight aria-hidden size={18} />
        </Link>
      </section>
    );
  }

  return (
    <section className="cart-page">
      <div className="section-heading">
        <span className="panel-label">Cart</span>
        <h1>Review your handmade order.</h1>
      </div>

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => {
            const key = getItemKey(item);

            return (
              <article className="cart-item" key={key}>
                <Image src={item.imageUrl} alt={item.name} width={140} height={140} />
                <div>
                  <Link href={`/products/${item.slug}`}>{item.name}</Link>
                  <span>{item.categoryName}</span>
                  {Object.values(item.customization).filter(Boolean).length > 0 ? (
                    <small>{Object.values(item.customization).filter(Boolean).join(" / ")}</small>
                  ) : null}
                  <strong>{formatINR(item.unitPrice)}</strong>
                </div>
                <div className="cart-item-controls">
                  <input
                    aria-label={`Quantity for ${item.name}`}
                    type="number"
                    min={1}
                    max={20}
                    value={item.quantity}
                    onChange={(event) => updateQuantity(key, Number(event.target.value))}
                  />
                  <button className="icon-link" aria-label={`Remove ${item.name}`} onClick={() => removeItem(key)}>
                    <Trash2 aria-hidden size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="order-summary">
          <h2>Summary</h2>
          <div className="summary-total">
            <span>Subtotal</span>
            <strong>{formatINR(subtotal)}</strong>
          </div>
          <p className="summary-note">Shipping is category-based and calculated at checkout.</p>
          <Link className="primary-button" href="/checkout">
            Checkout <ArrowRight aria-hidden size={18} />
          </Link>
        </aside>
      </div>
    </section>
  );
}
