/**
 * ✅ This file defines your NextAuth configuration (`authOptions`).
 * It controls:
 *   - How users log in (providers)
 *   - How their data is stored (adapter)
 *   - How sessions are managed (JWT vs DB)
 *   - What user data is exposed to the frontend (callbacks)
 *
 * 👉 Think of it as the “brain” of your authentication system.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * `authOptions` — the core NextAuth configuration object
 * This is passed into NextAuth() in `/api/auth/[...nextauth]/route.ts`.
 */
export const authOptions: NextAuthOptions = {
  /* ------------------------------------------------------------------------ */
  /* 1️⃣ ADAPTER — CONNECT NEXTAUTH TO YOUR DATABASE                           */
  /* ------------------------------------------------------------------------ */
  /**
   * The Prisma adapter makes NextAuth talk to your database through Prisma.
   * It automatically creates / updates / deletes:
   *   - Users
   *   - Accounts (OAuth, etc.)
   *   - Sessions
   *   - Verification tokens
   *
   * Even though we’re using JWTs for sessions (stateless), the adapter still
   * helps handle user persistence when needed.
   */
  adapter: PrismaAdapter(prisma),
  /* ------------------------------------------------------------------------ */
  /* 2️⃣ PROVIDERS — HOW USERS LOG IN                                          */
  /* ------------------------------------------------------------------------ */
  /**
   * NextAuth supports many providers (Google, GitHub, etc.)
   * Here we define our own “Credentials” provider for email + password login.
   */
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      /* 🔒 The `authorize()` function runs on LOGIN. */
      /**
       * 🔁 Flow summary:
       *  1. User calls `signIn("credentials", { email, password })`
       *  2. NextAuth calls this `authorize()` function server-side
       *  3. You verify the credentials
       *  4. If valid → return a user object
       *     If invalid → return null (reject login)
       */
      async authorize(credentials) {
        // Reject immediately if missing email/password
        if (!credentials?.email || !credentials.password) return null;
        // 1️⃣ Look up the user by email in the Prisma `User` table
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        // 2️⃣ Compare entered password to the hashed password in DB
        if (!user || !user.password) {
          return null;
        }
        // 2️⃣ Compare the provided password with the hashed password in the DB
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) return null; // wrong password → reject
        // 3️⃣ Return a sanitized user object (this becomes `user` in JWT callback)
        //    ⚠️ Never return `password` or sensitive info
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          role: user.role,
          country: user.country,
          sex: user.sex,
          dob: user.dob ? user.dob.toISOString() : null,
          address: user.address,
          phoneNumber: user.phoneNumber,
          emailVerified: user.emailVerified
            ? user.emailVerified.toISOString()
            : null,
          verified: user.verified,
        };
      },
    }),
  ],
  /* ------------------------------------------------------------------------ */
  /* 3️⃣ SESSION STRATEGY — HOW WE STORE SESSION STATE                         */
  /* ------------------------------------------------------------------------ */
  /**
   * Options:
   *  - "database" → store active sessions in DB (persistent)
   *  - "jwt"       → store session info in encrypted JWT cookie (stateless)
   *
   * We choose "jwt" because:
   *  ✅ faster (no DB lookup on every request)
   *  ✅ scales easily
   *  ⚠️ user data must be manually kept in sync with DB (we handle below)
   */
  session: {
    strategy: "jwt", // store session in encrypted JWT instead of DB
  },
  /* ------------------------------------------------------------------------ */
  /* 4️⃣ PAGES — CUSTOM ROUTES                                                 */
  /* ------------------------------------------------------------------------ */
  /**
   * By default, NextAuth shows its own login UI.
   * This tells it to use your custom page at `/auth/login` instead.
   */
  pages: {
    signIn: "/auth/login",
  },
  /* ------------------------------------------------------------------------ */
  /* 5️⃣ CALLBACKS — MODIFY DATA DURING AUTH FLOW                              */
  /* ------------------------------------------------------------------------ */
  /**
   * Callbacks let you hook into internal events.
   * The two key ones here:
   *  - `jwt()` runs when tokens are created or updated
   *  - `session()` runs when the frontend requests session data
   */
  callbacks: {
    /* ---------------------------------------------------------------------- */
    /* 🔹 JWT CALLBACK — internal "source of truth" for user state             */
    /* ---------------------------------------------------------------------- */
    /**
     * Runs every time a token is created or accessed.
     * Used to:
     *   - Attach user data at login
     *   - Re-sync with the database when profile updates happen
     *
     * The token is stored in the browser cookie (client side) and
     * decrypted automatically by NextAuth on each request.
     */
    async jwt({ token, user, trigger }) {
      // 🧩 CASE 1 — When a user just logged in
      //   → Attach all the user info to the token payload.
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.username = user.username;
        token.role = user.role;
        token.country = user.country;
        token.sex = user.sex;
        token.dob = user.dob;
        token.address = user.address;
        token.phoneNumber = user.phoneNumber;
        token.emailVerified = user.emailVerified
          ? user.emailVerified instanceof Date
            ? user.emailVerified.toISOString()
            : user.emailVerified
          : null;
        token.verified = user.verified ?? false;
        return token;
      }

      // 🧩 CASE 2 — When `useSession().update()` is called client-side
      //   → Re-fetch the latest user record from DB to keep session fresh.
      if (trigger === "update") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
          });
          if (dbUser) {
            token.firstName = dbUser.firstName;
            token.lastName = dbUser.lastName;
            token.username = dbUser.username;
            token.role = dbUser.role;
            token.country = dbUser.country;
            token.sex = dbUser.sex;
            token.dob = dbUser.dob ? dbUser.dob.toISOString() : null;
            token.address = dbUser.address;
            token.phoneNumber = dbUser.phoneNumber;
            token.emailVerified = dbUser.emailVerified
              ? dbUser.emailVerified.toISOString()
              : null;
            token.verified = dbUser.verified;
          }
        } catch (err) {
          console.error("⚠️ JWT refresh error:", err);
        }
      }

      return token;
    },

    /* ---------------------------------------------------------------------- */
    /* 🔹 SESSION CALLBACK — what the frontend receives from `useSession()`    */
    /* ---------------------------------------------------------------------- */
    /**
     * This runs whenever the client or server calls:
     *   - `useSession()` (React hook)
     *   - `getServerSession()` (server-side)
     *
     * Whatever you attach here is what your frontend sees in `session.user`.
     * (It’s a “projection” of the JWT payload)
     */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
        session.user.username = token.username as string | null;
        session.user.role = token.role as string | null;
        session.user.country = token.country as string | null;
        session.user.sex = token.sex as string | null;
        session.user.dob = token.dob as string | null;
        session.user.address = token.address as string | null;
        session.user.phoneNumber = token.phoneNumber as string | null;
        session.user.emailVerified = token.emailVerified as string | null;
        session.user.verified = token.verified as boolean;
      }
      return session;
    },
  },
};
