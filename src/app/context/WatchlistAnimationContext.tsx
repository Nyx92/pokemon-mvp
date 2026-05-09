"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/app/hooks/useAuth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlyItem {
  id: number;
  imageUrl: string;
  sourceRect: DOMRect;
}

export interface WatchlistAnimationContextValue {
  /** Ref to attach to the navbar watchlist IconButton (fly destination). */
  navbarIconRef: React.RefObject<HTMLButtonElement | null>;
  /**
   * Trigger the fly-to-navbar animation. Returns a cancel function; call it
   * if the subsequent API request fails so the count increment is rolled back.
   */
  triggerFly: (sourceRect: DOMRect, imageUrl: string) => () => void;
  /** Adjust the badge count without animation — pass -1 when removing. */
  adjustCount: (delta: number) => void;
  count: number;
}

// ── Context ───────────────────────────────────────────────────────────────────

const WatchlistAnimationContext =
  createContext<WatchlistAnimationContextValue | null>(null);

export function useWatchlistAnimation(): WatchlistAnimationContextValue {
  const ctx = useContext(WatchlistAnimationContext);
  if (!ctx)
    throw new Error(
      "useWatchlistAnimation must be used inside WatchlistAnimationProvider"
    );
  return ctx;
}

// ── Single flying element ─────────────────────────────────────────────────────

function FlyingItem({
  item,
  destRef,
  onComplete,
}: {
  item: FlyItem;
  destRef: React.RefObject<HTMLElement | null>;
  onComplete: (id: number) => void;
}) {
  const SIZE = 52;
  const destRect = destRef.current?.getBoundingClientRect();

  const destCx = destRect ? destRect.left + destRect.width / 2 : 0;
  const destCy = destRect ? destRect.top + destRect.height / 2 : 0;
  const sourceCx = item.sourceRect.left + item.sourceRect.width / 2;
  const sourceCy = item.sourceRect.top + item.sourceRect.height / 2;

  const initDx = sourceCx - destCx;
  const initDy = sourceCy - destCy;
  const initScale =
    Math.max(item.sourceRect.width, item.sourceRect.height) / SIZE;

  const [transform, setTransform] = useState(
    `translate(${initDx}px, ${initDy}px) scale(${initScale})`
  );
  const [opacity, setOpacity] = useState(1);
  const firedRef = useRef(false);

  useEffect(() => {
    // Double rAF ensures the initial transform is painted before we transition
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        setTransform("translate(0px, 0px) scale(0.2)");
        setOpacity(0);
      });
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, []);

  if (!destRect) return null;

  return (
    <div
      onTransitionEnd={() => {
        if (firedRef.current) return;
        firedRef.current = true;
        onComplete(item.id);
      }}
      style={{
        position: "fixed",
        // Centered over the navbar icon
        left: destCx - SIZE / 2,
        top: destCy - SIZE / 2,
        width: SIZE,
        height: SIZE,
        transform,
        opacity,
        // transform uses spring-like ease, opacity fades out later in the journey
        transition:
          "transform 0.65s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease 0.2s",
        zIndex: 9999,
        borderRadius: "8px",
        overflow: "hidden",
        pointerEvents: "none",
        willChange: "transform, opacity",
        boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
      }}
    >
      {/* Plain <img> — this lives in a portal outside Next.js image scope */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl || "/placeholder.png"}
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WatchlistAnimationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn } = useAuth();
  const navbarIconRef = useRef<HTMLButtonElement | null>(null);
  const [count, setCount] = useState(0);
  const [flies, setFlies] = useState<FlyItem[]>([]);
  const [mounted, setMounted] = useState(false);

  // Avoid SSR/hydration mismatch for the portal
  useEffect(() => setMounted(true), []);

  // Seed badge count from the server whenever auth state changes
  useEffect(() => {
    if (!isLoggedIn) {
      setCount(0);
      return;
    }
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.cards)) setCount(data.cards.length);
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const triggerFly = useCallback(
    (sourceRect: DOMRect, imageUrl: string): (() => void) => {
      const id = Date.now() + Math.random();
      setFlies((prev) => [...prev, { id, imageUrl, sourceRect }]);

      let cancelled = false;
      // Increment count after the animation completes (~700 ms)
      const timer = setTimeout(() => {
        if (!cancelled) setCount((prev) => prev + 1);
      }, 750);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
    []
  );

  const adjustCount = useCallback((delta: number) => {
    setCount((prev) => Math.max(0, prev + delta));
  }, []);

  const handleFlyComplete = useCallback((id: number) => {
    setFlies((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return (
    <WatchlistAnimationContext.Provider
      value={{ navbarIconRef, triggerFly, adjustCount, count }}
    >
      {children}
      {mounted &&
        createPortal(
          <>
            {flies.map((fly) => (
              <FlyingItem
                key={fly.id}
                item={fly}
                destRef={navbarIconRef as React.RefObject<HTMLElement | null>}
                onComplete={handleFlyComplete}
              />
            ))}
          </>,
          document.body
        )}
    </WatchlistAnimationContext.Provider>
  );
}
