// instrumentation-client.ts
//
// Next.js's client-side instrumentation hook — executes in the browser
// before React hydrates (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client).

import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_VERCEL_ENV mirrors the server-only VERCEL_ENV for the
// browser bundle — only set on Vercel, never during local `pnpm dev`, so
// a visitor's local dev session never reports here either.
if (process.env.NEXT_PUBLIC_VERCEL_ENV) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV,
    tracesSampleRate: 1.0,
  });
}

// Tags each Sentry event with the route the visitor navigated to, so an
// error report shows what page they were on.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
