"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  startTransition,
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

  // Read the destination rect in a layout effect (after the DOM has
  // settled, before paint) rather than during render — reading a ref's
  // .current directly in the render body can race a layout change and
  // land the animation in the wrong spot. Storing it in state also means
  // the component renders nothing (see the `!destRect` guard below) until
  // a real measurement is available, instead of ever computing off a
  // stale/absent rect.
  const [destRect, setDestRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    setDestRect(destRef.current?.getBoundingClientRect() ?? null);
  }, [destRef]);

  // Whether the fly-out transition (toward the destination, scaled down and
  // faded) has started. The actual transform/opacity are derived from this
  // flag below rather than stored as their own state, so there's no
  // separate "initial transform" value that could be seeded before destRect
  // is known.
  const [animated, setAnimated] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    // Double rAF ensures the initial transform is painted before we transition
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => {
        setAnimated(true);
      });
      return () => cancelAnimationFrame(r2);
    });
    return () => cancelAnimationFrame(r1);
  }, []);

  if (!destRect) return null;

  const destCx = destRect.left + destRect.width / 2;
  const destCy = destRect.top + destRect.height / 2;
  const sourceCx = item.sourceRect.left + item.sourceRect.width / 2;
  const sourceCy = item.sourceRect.top + item.sourceRect.height / 2;

  const initDx = sourceCx - destCx;
  const initDy = sourceCy - destCy;
  const initScale =
    Math.max(item.sourceRect.width, item.sourceRect.height) / SIZE;

  const transform = animated
    ? "translate(0px, 0px) scale(0.2)"
    : `translate(${initDx}px, ${initDy}px) scale(${initScale})`;
  const opacity = animated ? 0 : 1;

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

  // Avoid SSR/hydration mismatch for the portal. This is the standard
  // "has the client mounted" flag — there's nothing to derive it from (it
  // exists purely to make the client's first render match the server's,
  // then flip once we're past hydration), so a synchronous setState here
  // is unavoidable rather than a sign the effect should be restructured.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/hydration mount flag, not synchronizable any other way
  useEffect(() => setMounted(true), []);

  // Seed badge count from the server whenever auth state changes. When
  // logged out, `count` is masked to 0 below (derived at render) instead of
  // resetting the state here — avoids a synchronous setState-in-effect
  // while keeping the same displayed value.
  // setCount is wrapped in startTransition — this provider wraps every
  // page, and an ordinary setState here can otherwise win the scheduler
  // over a pending route-change transition, visibly delaying navigation.
  // See the same fix + rationale in HomeFeatured.tsx.
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.cards)) startTransition(() => setCount(data.cards.length));
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const triggerFly = useCallback(
    (sourceRect: DOMRect, imageUrl: string): (() => void) => {
      const id = Date.now() + Math.random();
      setFlies((prev) => [...prev, { id, imageUrl, sourceRect }]);

      let cancelled = false;
      let fired = false;
      let rolledBack = false;
      // Increment count after the animation completes (~700 ms)
      const timer = setTimeout(() => {
        fired = true;
        if (!cancelled) setCount((prev) => prev + 1);
      }, 750);

      return () => {
        cancelled = true;
        clearTimeout(timer);
        // clearTimeout is a no-op once the timer has already fired — if the
        // caller cancels AFTER the 750ms increment already happened (e.g. a
        // slow watchlist POST that fails after the animation finished), roll
        // the increment back explicitly so the badge count doesn't drift.
        // rolledBack guards against a second invocation of this same closure
        // double-decrementing the count (mirrors the firedRef guard above).
        if (fired && !rolledBack) {
          rolledBack = true;
          setCount((prev) => Math.max(0, prev - 1));
        }
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
      value={{ navbarIconRef, triggerFly, adjustCount, count: isLoggedIn ? count : 0 }}
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
