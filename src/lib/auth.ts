/**
 * This file defines your NextAuth configuration (`authOptions`).
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isValid) return null;

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

  session: {
    strategy: "jwt", // store session in encrypted JWT instead of DB
  },

  pages: {
    signIn: "/auth/signin",
  },

  /**
   * ✅ Callbacks: customize what gets encoded in JWT & returned via /api/auth/session
   */
  callbacks: {
    // 1️⃣ Runs whenever a JWT is created or updated
    async jwt({ token, user }) {
      function safeDateToISOString(value: unknown): string | null {
        if (!value) return null;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === "string") return value;
        return null;
      }

      // If user just signed in, attach user details to the token
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.username = user.username;
        token.role = user.role;
        token.country = user.country;
        token.sex = user.sex;
        token.dob = safeDateToISOString(user.dob);
        token.address = user.address;
        token.phoneNumber = user.phoneNumber;
        token.emailVerified = safeDateToISOString(user.emailVerified);
        token.verified = user.verified ?? false;
      }
      return token;
    },

    // 2️⃣ Runs whenever /api/auth/session is called
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
