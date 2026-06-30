"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, CreditCard, ShoppingBag } from "lucide-react";
import { createOrderAction } from "@/app/actions/checkout";
import { useCart } from "@/components/cart-provider";
import { formatINR } from "@/lib/money";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = {};

export function CheckoutClient({ userName }: { userName: string }) {
  const { items, subtotal, getItemKey } = useCart();
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const cartPayload = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    customization: item.customization,
  }));

  if (items.length === 0) {
    return (
      <section className="empty-state">
        <ShoppingBag aria-hidden size={32} />
        <h1>Your cart is ready for a little resin magic.</h1>
        <p>Add a product before checkout.</p>
        <Link className="primary-button" href="/products">
          Shop products <ArrowRight aria-hidden size={18} />
        </Link>
      </section>
    );
  }

  return (
    <section className="checkout-grid">
      <form className="checkout-form" action={formAction}>
        <div>
          <span className="panel-label">Logged in as {userName}</span>
          <h1>Delivery details</h1>
        </div>
        <input type="hidden" name="cartJson" value={JSON.stringify(cartPayload)} />
        <label>
          <span>Recipient name</span>
          <input name="deliveryName" defaultValue={userName} required />
          {state.fieldErrors?.deliveryName ? <small>{state.fieldErrors.deliveryName[0]}</small> : null}
        </label>
        <label>
          <span>Phone</span>
          <input name="deliveryPhone" autoComplete="tel" required />
          {state.fieldErrors?.deliveryPhone ? <small>{state.fieldErrors.deliveryPhone[0]}</small> : null}
        </label>
        <label>
          <span>Address line 1</span>
          <input name="deliveryLine1" autoComplete="address-line1" required />
          {state.fieldErrors?.deliveryLine1 ? <small>{state.fieldErrors.deliveryLine1[0]}</small> : null}
        </label>
        <label>
          <span>Address line 2</span>
          <input name="deliveryLine2" autoComplete="address-line2" />
        </label>
        <div className="form-grid">
          <label>
            <span>City</span>
            <input name="deliveryCity" autoComplete="address-level2" required />
          </label>
          <label>
            <span>State</span>
            <input name="deliveryState" autoComplete="address-level1" required />
          </label>
          <label>
            <span>Pincode</span>
            <input name="deliveryPincode" autoComplete="postal-code" required />
          </label>
        </div>
        <label>
          <span>Custom order note</span>
          <textarea name="customNotes" placeholder="Timeline, gifting date, reference idea, preferred delivery notes" />
        </label>
        {state.message ? <p className="form-message">{state.message}</p> : null}
        <button className="primary-button" disabled={pending} type="submit">
          <CreditCard aria-hidden size={18} />
          Continue to payment
        </button>
      </form>

      <aside className="order-summary">
        <h2>Order summary</h2>
        <div className="summary-list">
          {items.map((item) => (
            <div className="summary-item" key={getItemKey(item)}>
              <Image src={item.imageUrl} alt={item.name} width={96} height={96} />
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} x {formatINR(item.unitPrice)}
                </span>
                {Object.values(item.customization).filter(Boolean).length > 0 ? (
                  <small>{Object.values(item.customization).filter(Boolean).join(" / ")}</small>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        <div className="summary-total">
          <span>Subtotal</span>
          <strong>{formatINR(subtotal)}</strong>
        </div>
        <p className="summary-note">Category-based delivery charges are calculated on order creation.</p>
      </aside>
    </section>
  );
}
