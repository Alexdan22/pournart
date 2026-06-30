"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: CartItem) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
  getItemKey: (item: Pick<CartItem, "productId" | "customization">) => string;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "pournart_cart";

function getItemKey(item: Pick<CartItem, "productId" | "customization">) {
  return `${item.productId}:${JSON.stringify(item.customization)}`;
}

function readStoredCart() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as CartItem[];
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setItems(readStoredCart());
        setHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

  const addItem = useCallback((item: CartItem) => {
    setItems((currentItems) => {
      const key = getItemKey(item);
      const existing = currentItems.find((currentItem) => getItemKey(currentItem) === key);

      if (!existing) {
        return [...currentItems, item];
      }

      return currentItems.map((currentItem) =>
        getItemKey(currentItem) === key
          ? { ...currentItem, quantity: currentItem.quantity + item.quantity }
          : currentItem,
      );
    });
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((currentItems) =>
      currentItems
        .map((item) => (getItemKey(item) === key ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((currentItems) => currentItems.filter((item) => getItemKey(item) !== key));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((total, item) => total + item.quantity, 0),
      subtotal: items.reduce((total, item) => total + item.unitPrice * item.quantity, 0),
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
      getItemKey,
    }),
    [addItem, clearCart, items, removeItem, updateQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }

  return context;
}
