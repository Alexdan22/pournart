"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartLink() {
  const { count } = useCart();

  return (
    <Link className="icon-link cart-icon-link" href="/cart" aria-label={`Cart with ${count} items`}>
      <ShoppingBag aria-hidden size={20} />
      {count > 0 ? <span className="cart-count">{count}</span> : null}
    </Link>
  );
}
