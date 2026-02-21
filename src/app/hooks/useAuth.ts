"use client";

import { useSession } from "next-auth/react";

export function useAuth() {
  const { data: session, status, update } = useSession();
  const user = session?.user ?? null;

  return {
    user,
    userId: user?.id ?? null,
    isLoggedIn: !!user,
    isAdmin: user?.role === "admin",
    status, // "loading" | "authenticated" | "unauthenticated"
    update, // useful after profile edit
  };
}
