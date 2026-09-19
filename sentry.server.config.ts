// sentry.server.config.ts
//
// Node.js runtime init, loaded by instrumentation.ts's register() when
// NEXT_RUNTIME === "nodejs". See sentry.edge.config.ts for the edge
// runtime's identical setup, and instrumentation-client.ts for the browser.

import * as Sentry from "@sentry/nextjs";

// VERCEL_ENV is only set on Vercel ("production" | "preview" | "development"
// for a Vercel-triggered local dev — practically always production/preview
// here) — never during local `pnpm dev`, so local errors never reach Sentry
// or trigger a Discord alert.
if (process.env.VERCEL_ENV) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV,
    // Free plan includes 5M spans/month — generous headroom at this app's
    // traffic. Lower this from Sentry's dashboard if usage ever approaches
    // the quota; Sentry just stops ingesting past it, never bills silently.
    tracesSampleRate: 1.0,
  });
}
