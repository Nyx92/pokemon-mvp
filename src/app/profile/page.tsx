import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProfileCard from "./ProfileCard";

export default async function ProfilePage() {
  // 🔐 Get the current user session on the SERVER before rendering.
  // This reads the auth cookie, verifies the JWT, runs NextAuth callbacks,
  // and returns the authenticated user (or null if not logged in).
  // Used here to protect this page and redirect unauthenticated users early.
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  return <ProfileCard />;
}
