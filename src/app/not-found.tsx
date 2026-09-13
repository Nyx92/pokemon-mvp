import ErrorState from "@/app/shared-components/ErrorState";

// App-wide 404 — rendered whenever a route doesn't match, or a page calls
// next/navigation's notFound(). Reuses the same ErrorState block the
// marketplace error boundary uses, so 404s look consistent with the rest of
// the app instead of falling back to Next's generic 404 page.
export default function NotFound() {
  return (
    <ErrorState
      variant="not_found"
      title="Page not found"
      subtitle="The page you're looking for doesn't exist or may have moved."
      action={{ label: "Back to marketplace", href: "/marketplace" }}
    />
  );
}
