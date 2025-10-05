import { create } from "zustand";
import type { Session } from "next-auth";

interface UserState {
  user: Session["user"] | null;
  setUser: (user: Session["user"] | null) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
