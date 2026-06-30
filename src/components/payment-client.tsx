"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { markLocalPaymentPaidAction } from "@/app/actions/checkout";
import { useCart } from "@/components/cart-provider";
import { formatINR } from "@/lib/money";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type PaymentClientProps = {
  orderNumber: string;
  amount: number;
  razorpayOrderId: string | null;
  razorpayKey: string;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };
};

export function PaymentClient({
  orderNumber,
  amount,
  razorpayOrderId,
  razorpayKey,
  customer,
}: PaymentClientProps) {
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  async function payWithRazorpay() {
    setError("");
    setLoading(true);

    if (!window.Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      }).catch(() => {
        setError("Could not load Razorpay checkout. Please try again.");
      });
    }

    if (!window.Razorpay || !razorpayOrderId) {
      setLoading(false);
      return;
    }

    const checkout = new window.Razorpay({
      key: razorpayKey,
      amount,
      currency: "INR",
      name: "Pour n Art",
      description: `Order ${orderNumber}`,
      order_id: razorpayOrderId,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone || "",
      },
      theme: { color: "#0f766e" },
      handler: async (response: Record<string, string>) => {
        const result = await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderNumber,
            ...response,
          }),
        });
        const data = await result.json();

        if (!result.ok) {
          setError(data.error || "Payment verification failed.");
          setLoading(false);
          return;
        }

        window.location.href = data.redirectTo;
      },
      modal: {
        ondismiss: () => setLoading(false),
      },
    });

    checkout.open();
  }

  if (!razorpayKey || !razorpayOrderId) {
    return (
      <form className="payment-panel" action={markLocalPaymentPaidAction}>
        <input type="hidden" name="orderNumber" value={orderNumber} />
        <span className="panel-label">Local demo mode</span>
        <h1>{formatINR(amount)}</h1>
        <p>Razorpay keys are not configured yet. Use this button to test the order lifecycle locally.</p>
        <button className="primary-button" type="submit">
          <CreditCard aria-hidden size={18} />
          Mark demo payment paid
        </button>
      </form>
    );
  }

  return (
    <section className="payment-panel">
      <span className="panel-label">Secure Razorpay checkout</span>
      <h1>{formatINR(amount)}</h1>
      <p>Order {orderNumber} is ready for payment. After verification, tracking starts automatically.</p>
      {error ? <p className="form-message">{error}</p> : null}
      <button className="primary-button" disabled={loading} type="button" onClick={payWithRazorpay}>
        {loading ? <Loader2 aria-hidden className="spin" size={18} /> : <CreditCard aria-hidden size={18} />}
        Pay with Razorpay
      </button>
    </section>
  );
}
