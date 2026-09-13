"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Segment-level error boundary for /checkout/* — mirrors
// src/app/marketplace/error.tsx. Catches unhandled errors thrown while
// rendering checkout pages (e.g. the Stripe session lookup in
// checkout/success/page.tsx) instead of taking down the whole app with
// Next's generic error page.
export default function CheckoutError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Couldn't load checkout"
      subtitle="Something went wrong finishing checkout. Please try again."
      action={{ label: "Try again", onClick: reset }}
    />
  );
}
