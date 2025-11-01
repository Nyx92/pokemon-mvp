/**
 * This file sets up and exports a wrapper around NextAuth’s `SessionProvider`.
 *
 * ✅ What it does:
 * - Provides authentication/session context to your React app.
 * - Ensures the user’s session (login state) is available anywhere in your component tree.
 * - Marks the component with `"use client"` so it can safely use React Context in the Next.js App Router.
 *
 * ✅ Why it’s needed:
 * - In Next.js 13+ App Router, layouts and most components are Server Components by default.
 * - React Context providers (like `SessionProvider`) must run on the client.
 * - Without this wrapper, you’d get “React Context is unavailable in Server Components” errors.
 *
 * ✅ How it works:
 * - `SessionProviderWrapper` is a simple Client Component.
 * - It wraps `SessionProvider` around `children`.
 * - Anything inside `children` can now access session data with NextAuth hooks (`useSession`, etc.).
 *
 * 👉 TL;DR: This file is your "auth context provider."
 * You import `<SessionProviderWrapper>` at the root of your app (e.g., in `layout.tsx`)
 * so all pages/components know if the user is signed in.
 */

"use client";

import { SessionProvider } from "next-auth/react";

// A wrapper component to make NextAuth session data available in your app.
// Wraps your entire app tree with <SessionProvider>.
export default function SessionProviderWrapper({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: any; // NextAuth Session object
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
