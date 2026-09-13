"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Segment-level error boundary for /offers — mirrors
// src/app/marketplace/error.tsx.
export default function OffersError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Couldn't load your offers"
      action={{ label: "Try again", onClick: reset }}
    />
  );
}
