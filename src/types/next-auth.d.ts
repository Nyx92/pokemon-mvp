import NextAuth, { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface User extends DefaultUser {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    role?: string | null;
    country?: string | null;
    sex?: string | null;
    dob?: string | null;
    address?: string | null;
    phoneNumber?: string | null;
    emailVerified?: string | null;
    verified?: boolean;
  }

  interface Session {
    user: User & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    role?: string | null;
    country?: string | null;
    sex?: string | null;
    dob?: string | null;
    address?: string | null;
    phoneNumber?: string | null;
    emailVerified?: string | null;
    verified?: boolean;
  }
}
