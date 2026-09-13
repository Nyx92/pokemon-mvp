"use client";

// Catches failures in the ROOT LAYOUT itself (src/app/layout.tsx) — e.g. the
// getServerSession() call there throwing. Per Next 14 convention this file
// replaces the entire root layout when triggered, so it must render its own
// <html>/<body> and cannot assume ThemeRegistry, MUI, or any other provider
// from layout.tsx is available. Keep this as plain, dependency-free
// markup/inline styles only.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#f4f4f4",
          color: "#111",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", maxWidth: 400 }}>
          We hit an unexpected error and couldn&apos;t load the app. Please try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
            fontSize: 14,
            fontWeight: 600,
            padding: "10px 24px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            backgroundColor: "#fff",
            color: "#111",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
