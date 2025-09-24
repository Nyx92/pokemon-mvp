/**
 * This file wires up NextAuth into Next.js App Router.
 *
 * ✅ What it does:
 * - Imports your authentication configuration (`authOptions`) from src/lib/auth.ts
 * - Creates a NextAuth request handler with that config
 * - Exposes that handler to Next.js for both GET and POST requests
 *
 * ✅ Why it’s needed:
 * - NextAuth centralizes all auth routes under `/api/auth/*`
 *   Examples:
 *   - GET /api/auth/signin → render the sign-in page
 *   - POST /api/auth/callback → process credentials and log user in
 *   - GET /api/auth/session → fetch the current session
 *   - POST /api/auth/signout → log the user out
 *
 * ✅ How it works:
 * - `NextAuth(authOptions)` generates a handler function that understands these routes
 * - `export { handler as GET, handler as POST }` tells Next.js to use that handler
 *   for any GET or POST request made to `/api/auth/[...nextauth]`
 *
 * 👉 TL;DR: This file is the entrypoint for all authentication-related API routes.
 */

// Import the NextAuth main handler function.
// This is the "entrypoint" that powers all NextAuth routes
import NextAuth from "next-auth";

// Import your NextAuth configuration options (providers, adapters, callbacks, etc.).
// You defined these in src/lib/auth.ts
import { authOptions } from "@/lib/auth";

// Create a NextAuth request handler using your configuration i.e., authOptions.
// This returns a function that knows how to respond to requests for /api/auth/*.
// For example: /api/auth/signin, /api/auth/callback, /api/auth/session, etc.
const handler = NextAuth(authOptions);

// Export the handler for both GET and POST requests.
// Next.js App Router requires you to explicitly export HTTP methods in `route.ts`.
// - GET covers routes like /api/auth/session, /api/auth/signin (rendering pages).
// - POST covers routes like /api/auth/callback (when credentials are submitted).
export { handler as GET, handler as POST };
