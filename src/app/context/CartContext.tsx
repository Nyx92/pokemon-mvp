"use client";

// CartContext — provides cart state and actions to the whole app.
//
// count        : total number of items in the cart (for the navbar badge)
// addToCart    : POST /api/cart — returns whether the card was already present
// decrementCount : optimistic decrement for remove / uncheck flows
// refreshCount : re-fetches item count from the server (e.g. after checkout)

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/app/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CartContextValue {
  count: number;
  addToCart: (
    cardId: string
  ) => Promise<{ success: boolean; alreadyInCart: boolean }>;
  decrementCount: (by?: number) => void;
  refreshCount: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [count, setCount] = useState(0);

  // Fetch total item count from the cart API and seed the badge
  const refreshCount = useCallback(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.packages)) {
          const total = (data.packages as { items: unknown[] }[]).reduce(
            (sum, pkg) => sum + pkg.items.length,
            0
          );
          setCount(total);
        }
      })
      .catch(() => {});
  }, []);

  // Re-seed whenever the user logs in or out
  useEffect(() => {
    if (!isLoggedIn) {
      setCount(0);
      return;
    }
    refreshCount();
  }, [isLoggedIn, refreshCount]);

  const addToCart = useCallback(
    async (
      cardId: string
    ): Promise<{ success: boolean; alreadyInCart: boolean }> => {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });

      if (!res.ok) {
        return { success: false, alreadyInCart: false };
      }

      const data = await res.json();
      // Only increment badge for genuinely new additions
      if (data.success && !data.alreadyInCart) {
        setCount((prev) => prev + 1);
      }
      return { success: data.success, alreadyInCart: data.alreadyInCart };
    },
    []
  );

  const decrementCount = useCallback((by = 1) => {
    setCount((prev) => Math.max(0, prev - by));
  }, []);

  return (
    <CartContext.Provider value={{ count, addToCart, decrementCount, refreshCount }}>
      {children}
    </CartContext.Provider>
  );
}
