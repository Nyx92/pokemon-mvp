// sentry.edge.config.ts
//
// Edge runtime init, loaded by instrumentation.ts's register() when
// NEXT_RUNTIME === "edge". See sentry.server.config.ts for the Node.js
// runtime's identical setup, and instrumentation-client.ts for the browser.

import * as Sentry from "@sentry/nextjs";

// See sentry.server.config.ts — same reasoning, never active in local dev.
if (process.env.VERCEL_ENV) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV,
    tracesSampleRate: 1.0,
  });
}
