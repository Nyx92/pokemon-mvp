// instrumentation.ts
//
// Next.js's server-startup hook (https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// register() runs once per runtime (Node.js and Edge are separate
// processes on Vercel) before that runtime handles its first request.

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports any server-side error Next.js itself catches (Server Component
// render, Route Handler, Server Action) that would otherwise only surface
// as a generic 500 — see sentry.server.config.ts for why this only ever
// reports on Vercel, never during local `pnpm dev`.
export const onRequestError = Sentry.captureRequestError;
