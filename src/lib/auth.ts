/**
 * ✅ This file defines your NextAuth configuration (`authOptions`).
 * It tells NextAuth how to authenticate users, store sessions, and what data to expose.
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
  /**
   * 🔌 The Prisma adapter links NextAuth with your Prisma-managed database.
   * It automatically handles users, sessions, and account linking when applicable.
   */
  adapter: PrismaAdapter(prisma),
  /**
   * 🧩 Define which authentication methods (providers) are available.
   * In this case, we use a custom "Credentials" provider (email + password login).
   */
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      /**
       * 🔒 The `authorize()` function runs on the server when a user tries to log in
       * via `signIn("credentials", { email, password })`.
       *
       * Its job: verify the user's identity and return their profile if valid.
       * If null is returned → login fails.
       */
      async authorize(credentials) {
        // If email or password missing, immediately reject
        if (!credentials?.email || !credentials.password) return null;
        // 1️⃣ Look up the user in the database by email
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        // If no user or password hash found → reject
        if (!user || !user.password) {
          return null;
        }
        // 2️⃣ Compare the provided password with the hashed password in the DB
        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) return null; // wrong password → reject
        // 3️⃣ If valid → return the full user object (this becomes `user` in JWT callback)
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
  /**
   * ⚙️ Session settings
   * By default, NextAuth can store sessions in the DB or in JWTs.
   * Here we use JWTs (more stateless, no DB reads per request).
   */
  session: {
    strategy: "jwt", // store session in encrypted JWT instead of DB
  },
  /**
   * 📄 Custom page overrides (optional)
   * Here we tell NextAuth to use our own custom sign-in page route.
   */
  pages: {
    signIn: "/auth/login",
  },

  /**
   * 🧠 Callbacks — run automatically at key points in the auth lifecycle.
   * Used to customize what data is stored in JWTs or exposed in sessions.
   */
  callbacks: {
    /**
     * 🧠 JWT callback
     * Called whenever a JWT is created or accessed (e.g. login, getSession()).
     * We'll refresh user data from the DB whenever possible.
     */
    async jwt({ token, user, trigger }) {
      // 1️⃣ On initial login — attach full user info
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

      // 2️⃣ If triggered by client-side `update()` or a new session request → re-fetch DB
      // (only if we have a token.id)
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

    /**
     * 💡 Session callback
     * Maps token fields back into `session.user` (what frontend receives)
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
