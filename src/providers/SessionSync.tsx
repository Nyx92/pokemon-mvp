"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useUserStore } from "../app/store/userStore";

/**
 * Keeps Zustand user store automatically synced
 * with NextAuth session data.
 */
export default function SessionSync() {
  const { data: session } = useSession();
  const setUser = useUserStore((state) => state.setUser);
  const clearUser = useUserStore((state) => state.clearUser);

  useEffect(() => {
    if (session?.user) {
      setUser(session.user);
    } else {
      clearUser();
    }
  }, [session, setUser, clearUser]);

  return null; // no UI, runs silently
}
