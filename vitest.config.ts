import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration for the Pokemon MVP test suite.
 *
 * Vitest is the test runner. This file tells it:
 *   - WHERE to run tests (Node, not a browser)
 *   - WHAT fake environment variables to inject
 *   - HOW to resolve @/ path aliases used inside the route handlers
 *   - WHICH files to measure for code coverage
 *
 * Run tests with:
 *   pnpm test            → run all tests once (used in CI)
 *   pnpm test:watch      → re-run on file save (used during development)
 *   pnpm test:coverage   → run + generate a coverage report
 */
export default defineConfig({
  test: {
    // ── Environment ──────────────────────────────────────────────────────────
    // "node" means tests run in a plain Node.js process — no browser, no DOM.
    // This is correct because we are testing server-side API route handlers,
    // not React components or anything that needs a browser environment.
    environment: "node",

    // ── Globals ───────────────────────────────────────────────────────────────
    // Makes describe(), it(), expect(), vi() etc. available in every test file
    // without needing to import them. Saves an import line on every file.
    // The TypeScript types for these globals come from vitest's own type defs.
    globals: true,

    // ── Fake environment variables ────────────────────────────────────────────
    // The route handler files read process.env at the top of the module, e.g.:
    //   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, ...)
    //   if (!process.env.CRON_SECRET) throw ...
    //
    // If those variables are undefined, the module crashes before a single test
    // runs. These fake values prevent that crash.
    //
    // IMPORTANT: the actual values here do NOT matter and are never sent
    // anywhere real. Stripe and Prisma are fully mocked in every test file —
    // no real network calls, no real database connections are ever made.
    env: {
      STRIPE_SECRET_KEY: "sk_test_fake",
      STRIPE_WEBHOOK_SECRET: "whsec_fake",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_fake",
      // Must match what the cron tests use as the bearer token
      CRON_SECRET: "test-cron-secret",
      NEXTAUTH_SECRET: "test-secret",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      // Never actually connected to — Prisma is mocked
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    },

    // ── Coverage (pnpm test:coverage only) ───────────────────────────────────
    // Only relevant when running `pnpm test:coverage`. Ignored during normal
    // `pnpm test` runs.
    //
    // provider: "v8" uses Node's built-in V8 engine coverage tooling.
    // It is faster and needs no extra packages beyond @vitest/coverage-v8.
    //
    // reporter options:
    //   "text"  → prints a summary table in the terminal after tests finish
    //   "lcov"  → generates coverage/lcov.info (used by CI coverage services)
    //   "html"  → generates coverage/index.html (open in browser to explore)
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Only measure coverage for production code we actually care about.
      // This excludes things like Next.js page files, components, etc.
      include: ["src/app/api/**/*.ts", "src/lib/**/*.ts"],
      // Don't count the test files themselves as "covered" code
      exclude: ["src/**/*.test.ts"],
    },
  },

  // ── Path alias ─────────────────────────────────────────────────────────────
  // The route handler files use the @/ alias throughout, e.g.:
  //   import { prisma } from "@/lib/prisma"
  //   import { expireOffer } from "@/lib/offerExpiry"
  //
  // This alias is defined in tsconfig.json and Next.js picks it up automatically.
  // Vitest has its own module resolver and knows nothing about tsconfig, so we
  // must teach it the same rule here: @/ resolves to the src/ folder.
  //
  // Without this line every test file would crash with "Cannot find module @/..."
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
