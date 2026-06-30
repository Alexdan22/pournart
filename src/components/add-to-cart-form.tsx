"use client";

import { useMemo, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { formatINR } from "@/lib/money";
import type { CustomizationField } from "@/lib/types";

type AddToCartFormProps = {
  product: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string;
    price: number;
    handmadeDaysMin: number;
    handmadeDaysMax: number;
    category: { name: string };
  };
  customizationFields: CustomizationField[];
};

export function AddToCartForm({ product, customizationFields }: AddToCartFormProps) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [customization, setCustomization] = useState<Record<string, string>>({});
  const [added, setAdded] = useState(false);

  const total = useMemo(() => product.price * quantity, [product.price, quantity]);

  function handleAddToCart() {
    addItem({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      imageUrl: product.imageUrl,
      unitPrice: product.price,
      quantity,
      categoryName: product.category.name,
      handmadeDaysMin: product.handmadeDaysMin,
      handmadeDaysMax: product.handmadeDaysMax,
      customization,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  return (
    <section className="purchase-panel" aria-label="Customize and add to cart">
      <div>
        <span className="panel-label">Custom handmade order</span>
        <h2>{formatINR(product.price)}</h2>
        <p>
          Made in {product.handmadeDaysMin}-{product.handmadeDaysMax} days before dispatch.
        </p>
      </div>

      <div className="quantity-row">
        <label htmlFor="quantity">Quantity</label>
        <div className="stepper">
          <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
            -
          </button>
          <input
            id="quantity"
            min={1}
            max={20}
            value={quantity}
            type="number"
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))}
          />
          <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))}>
            +
          </button>
        </div>
      </div>

      <div className="custom-fields">
        {customizationFields.map((field) => (
          <label key={field.name}>
            <span>{field.label}</span>
            {field.type === "textarea" ? (
              <textarea
                placeholder={field.placeholder}
                value={customization[field.name] ?? ""}
                onChange={(event) =>
                  setCustomization((current) => ({ ...current, [field.name]: event.target.value }))
                }
              />
            ) : (
              <input
                placeholder={field.placeholder}
                value={customization[field.name] ?? ""}
                onChange={(event) =>
                  setCustomization((current) => ({ ...current, [field.name]: event.target.value }))
                }
              />
            )}
          </label>
        ))}
      </div>

      <button className="primary-button" type="button" onClick={handleAddToCart}>
        {added ? <Check aria-hidden size={18} /> : <ShoppingBag aria-hidden size={18} />}
        {added ? "Added" : `Add ${formatINR(total)}`}
      </button>
    </section>
  );
}
