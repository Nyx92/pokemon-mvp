"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Next.js route-level error boundary — automatically wraps page.tsx and
// catches any error thrown during rendering, including the async
// getListingsPage() call awaited there with no try/catch. Without this,
// an unhandled throw (e.g. Prisma connection-pool exhaustion, or
// resolveListingDisplay() throwing on a single orphaned catalog-less
// listing) takes down the entire /marketplace route with Next's generic
// error page instead of the in-page retry state this used to degrade to
// when the same fetch lived client-side in MarketPlace.tsx.
export default function MarketplaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Couldn't load the marketplace"
      action={{ label: "Try again", onClick: reset }}
      dark
    />
  );
}
