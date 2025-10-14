// Import Zustand for global state management
import { create } from "zustand";
// Import the NextAuth Session type so our store can share the same user shape
import type { Session } from "next-auth";

// ---------------------------------------------
// Define the shape (interface) of our Zustand store
// ---------------------------------------------
interface UserState {
  // The currently logged-in user (or null if not logged in)
  user: Session["user"] | null;

  // Function to update (or set) the user in the store
  // Accepts either:
  //  - a partial user object (e.g. { username: "Ash" })
  //  - or null (to clear the user)
  setUser: (user: Partial<Session["user"]> | null) => void;

  // Function to reset/clear the user completely
  clearUser: () => void;
}

// ---------------------------------------------
// Create the Zustand store instance
// ---------------------------------------------
export const useUserStore = create<UserState>()((set) => ({
  // Initial state: no user is logged in
  user: null,

  // Function to update the user state
  setUser: (user) =>
    set(
      (state): UserState => ({
        // If a user object is provided → merge with existing user (partial update)
        // Else → set to null (logged out)
        user: user ? ({ ...state.user, ...user } as Session["user"]) : null,

        // These preserve the function references on every update.
        // Without these, Zustand’s type inference can sometimes narrow incorrectly.
        setUser: state.setUser,
        clearUser: state.clearUser,
      })
    ),

  // Function to clear the user (used on logout)
  clearUser: () => set({ user: null }),
}));
