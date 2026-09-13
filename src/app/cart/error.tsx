"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Segment-level error boundary for /cart — mirrors
// src/app/marketplace/error.tsx.
export default function CartError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Couldn't load your cart"
      action={{ label: "Try again", onClick: reset }}
    />
  );
}
