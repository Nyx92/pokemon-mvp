"use client";

import ErrorState from "@/app/shared-components/ErrorState";

// Root error boundary — catches any unhandled render/data error thrown by a
// page or layout below this one that doesn't already have its own
// error.tsx (see marketplace/error.tsx, checkout/error.tsx, etc. for
// segment-level equivalents). Must be "use client" per Next 14 convention.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorState
      variant="error"
      title="Something went wrong"
      subtitle="We hit an unexpected error loading this page. Please try again."
      action={{ label: "Try again", onClick: reset }}
    />
  );
}
