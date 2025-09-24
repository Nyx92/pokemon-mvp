/**
 * This file defines your NextAuth configuration (`authOptions`).
 *
 * ✅ What it does:
 * - Tells NextAuth how to handle authentication in your app
 * - Configures:
 *   - The database adapter (Prisma + Postgres)
 *   - Authentication providers (here: Credentials login with email + password)
 *   - Session strategy (JWT tokens)
 *   - Custom auth pages (e.g. sign-in page path)
 *
 * ✅ Why it’s needed:
 * - NextAuth itself is just a framework; it needs a config to know:
 *   - Where to store users (Prisma adapter → Postgres)
 *   - How users can log in (credentials provider, Google, GitHub, etc.)
 *   - How to manage sessions (JWT vs database sessions)
 *
 * ✅ How it works:
 * - `PrismaAdapter(prisma)` → stores users, accounts, sessions in your Postgres DB
 * - `CredentialsProvider` → allows login via email/password (checks with your DB)
 * - `session: { strategy: "jwt" }` → session data stored in encrypted JWT, not DB
 * - `pages.signIn` → tells NextAuth where your custom sign-in UI lives
 *
 * 👉 TL;DR: This file is the "blueprint" that powers authentication.
 * It gets passed into `NextAuth()` in `/api/auth/[...nextauth]/route.ts`.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma"; // Prisma client for DB access

// NextAuthOptions is a config object that tells NextAuth:
// - Which database adapter to use
// - Which providers (Google, GitHub, Credentials, etc.)
// - How sessions are handled
// - Custom page routes (e.g., /auth/signin)

export const authOptions: NextAuthOptions = {
  // Adapter tells NextAuth how to store users, accounts, sessions, tokens in the DB
  adapter: PrismaAdapter(prisma),

  // Define which login providers you want to allow
  providers: [
    CredentialsProvider({
      name: "Credentials", // shows up on the sign-in page
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // The authorize() function runs whenever a user submits email+password
      async authorize(credentials) {
        // Basic validation
        if (!credentials?.email || !credentials.password) return null;

        // Look up the user in the database by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        // 🚨 TODO: In production, store hashed passwords in DB and compare with bcrypt
        // For now, just check plain text
        if (!user || user.password !== credentials.password) {
          return null; // invalid credentials → login fails
        }

        // If valid, return the user object → becomes part of the session
        return user;
      },
    }),
  ],

  // Session handling
  session: { strategy: "jwt" }, // use JSON Web Tokens (no DB lookups on every request)

  // Custom routes
  pages: {
    signIn: "/auth/signin", // tell NextAuth to use your custom signin page
  },
};
