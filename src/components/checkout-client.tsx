"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { ArrowRight, CreditCard, MapPin, Plus, ShoppingBag } from "lucide-react";
import { createOrderAction } from "@/app/actions/checkout";
import { useCart } from "@/components/cart-provider";
import { trackAnalyticsEvent } from "@/lib/analytics-client";
import { formatINR } from "@/lib/money";
import { warmDisplayCopy } from "@/lib/product-positioning";
import type { ActionState } from "@/lib/types";

const initialState: ActionState = {};

type SavedAddress = {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

type CheckoutClientProps = {
  user: {
    name: string;
    phone: string;
  };
  savedAddresses: SavedAddress[];
};

type DeliveryFields = {
  deliveryName: string;
  deliveryPhone: string;
  deliveryLine1: string;
  deliveryLine2: string;
  deliveryCity: string;
  deliveryState: string;
  deliveryPincode: string;
  deliveryAddressLabel: string;
};

function addressLine(address: SavedAddress) {
  return [address.line1, address.line2, address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(", ");
}

export function CheckoutClient({ user, savedAddresses }: CheckoutClientProps) {
  const { items, subtotal, getItemKey } = useCart();
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const firstAddress = savedAddresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState(firstAddress?.id ?? "new");
  const [saveAddress, setSaveAddress] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryFields>({
    deliveryName: user.name,
    deliveryPhone: user.phone,
    deliveryLine1: firstAddress?.line1 ?? "",
    deliveryLine2: firstAddress?.line2 ?? "",
    deliveryCity: firstAddress?.city ?? "",
    deliveryState: firstAddress?.state ?? "",
    deliveryPincode: firstAddress?.pincode ?? "",
    deliveryAddressLabel: firstAddress?.label ?? "Home",
  });
  const cartPayload = items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    customization: item.customization,
  }));

  useEffect(() => {
    if (items.length > 0) {
      void trackAnalyticsEvent("CHECKOUT_STARTED", {
        metadata: {
          itemCount: items.length,
          subtotal,
        },
      });
    }
  }, [items.length, subtotal]);

  function updateDeliveryField(field: keyof DeliveryFields, value: string) {
    setDelivery((current) => ({ ...current, [field]: value }));
  }

  function selectSavedAddress(address: SavedAddress) {
    setSelectedAddressId(address.id);
    setSaveAddress(true);
    setDelivery((current) => ({
      ...current,
      deliveryLine1: address.line1,
      deliveryLine2: address.line2 ?? "",
      deliveryCity: address.city,
      deliveryState: address.state,
      deliveryPincode: address.pincode,
      deliveryAddressLabel: address.label,
    }));
  }

  function selectNewAddress() {
    setSelectedAddressId("new");
    setSaveAddress(true);
    setDelivery((current) => ({
      ...current,
      deliveryLine1: "",
      deliveryLine2: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryPincode: "",
      deliveryAddressLabel: "Home",
    }));
  }

  if (items.length === 0) {
    return (
      <section className="empty-state">
        <ShoppingBag aria-hidden size={32} />
        <h1>Your cart is ready for a custom gift.</h1>
        <p>Add a handcrafted piece before checkout.</p>
        <Link className="primary-button" href="/products">
          Explore collections <ArrowRight aria-hidden size={18} />
        </Link>
      </section>
    );
  }

  return (
    <section className="checkout-grid">
      <form className="checkout-form" action={formAction}>
        <div>
          <span className="panel-label">Logged in as {user.name}</span>
          <h1>Delivery details</h1>
        </div>
        <input type="hidden" name="cartJson" value={JSON.stringify(cartPayload)} />
        {savedAddresses.length > 0 ? (
          <section className="checkout-address-book" aria-label="Saved addresses">
            <div className="mini-heading">
              <span className="panel-label">Saved addresses</span>
              <p>Use a saved address or add a new one for this order.</p>
            </div>
            <div className="address-choice-grid">
              {savedAddresses.map((address) => (
                <label
                  className={`address-choice ${selectedAddressId === address.id ? "selected" : ""}`}
                  key={address.id}
                >
                  <input
                    checked={selectedAddressId === address.id}
                    name="addressChoice"
                    onChange={() => selectSavedAddress(address)}
                    type="radio"
                    value={address.id}
                  />
                  <span className="address-choice-copy">
                    <strong>
                      <MapPin aria-hidden size={16} />
                      {address.label}
                    </strong>
                    <small>{addressLine(address)}</small>
                  </span>
                </label>
              ))}
              <label className={`address-choice ${selectedAddressId === "new" ? "selected" : ""}`}>
                <input
                  checked={selectedAddressId === "new"}
                  name="addressChoice"
                  onChange={selectNewAddress}
                  type="radio"
                  value="new"
                />
                <span className="address-choice-copy">
                  <strong>
                    <Plus aria-hidden size={16} />
                    Add a new address
                  </strong>
                  <small>Enter a fresh delivery address below.</small>
                </span>
              </label>
            </div>
          </section>
        ) : null}
        <label>
          <span>Recipient name</span>
          <input
            name="deliveryName"
            onChange={(event) => updateDeliveryField("deliveryName", event.target.value)}
            required
            value={delivery.deliveryName}
          />
          {state.fieldErrors?.deliveryName ? <small>{state.fieldErrors.deliveryName[0]}</small> : null}
        </label>
        <label>
          <span>Phone</span>
          <input
            name="deliveryPhone"
            autoComplete="tel"
            onChange={(event) => updateDeliveryField("deliveryPhone", event.target.value)}
            required
            value={delivery.deliveryPhone}
          />
          {state.fieldErrors?.deliveryPhone ? <small>{state.fieldErrors.deliveryPhone[0]}</small> : null}
        </label>
        <label>
          <span>Save as</span>
          <select
            name="deliveryAddressLabel"
            onChange={(event) => updateDeliveryField("deliveryAddressLabel", event.target.value)}
            value={delivery.deliveryAddressLabel}
          >
            <option>Home</option>
            <option>Work</option>
            <option>Gift address</option>
            <option>Family</option>
          </select>
        </label>
        <label>
          <span>Address line 1</span>
          <input
            name="deliveryLine1"
            autoComplete="address-line1"
            onChange={(event) => updateDeliveryField("deliveryLine1", event.target.value)}
            required
            value={delivery.deliveryLine1}
          />
          {state.fieldErrors?.deliveryLine1 ? <small>{state.fieldErrors.deliveryLine1[0]}</small> : null}
        </label>
        <label>
          <span>Address line 2</span>
          <input
            name="deliveryLine2"
            autoComplete="address-line2"
            onChange={(event) => updateDeliveryField("deliveryLine2", event.target.value)}
            value={delivery.deliveryLine2}
          />
        </label>
        <div className="form-grid">
          <label>
            <span>City</span>
            <input
              name="deliveryCity"
              autoComplete="address-level2"
              onChange={(event) => updateDeliveryField("deliveryCity", event.target.value)}
              required
              value={delivery.deliveryCity}
            />
          </label>
          <label>
            <span>State</span>
            <input
              name="deliveryState"
              autoComplete="address-level1"
              onChange={(event) => updateDeliveryField("deliveryState", event.target.value)}
              required
              value={delivery.deliveryState}
            />
          </label>
          <label>
            <span>Pincode</span>
            <input
              name="deliveryPincode"
              autoComplete="postal-code"
              onChange={(event) => updateDeliveryField("deliveryPincode", event.target.value)}
              required
              value={delivery.deliveryPincode}
            />
          </label>
        </div>
        <label className="check-row save-address-row">
          <input
            checked={saveAddress}
            name="saveAddress"
            onChange={(event) => setSaveAddress(event.target.checked)}
            type="checkbox"
          />
          <span>Save this address for future orders</span>
        </label>
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
              <Image src={item.imageUrl} alt={warmDisplayCopy(item.name)} width={96} height={96} />
              <div>
                <strong>{warmDisplayCopy(item.name)}</strong>
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
