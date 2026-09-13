"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Segment-level error boundary for /auctions — mirrors
// src/app/marketplace/error.tsx.
export default function AuctionsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Couldn't load auctions"
      action={{ label: "Try again", onClick: reset }}
      dark
    />
  );
}
