import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProfileContent from "./ProfileContent";

/**
 * /profile — Account settings page (server component).
 *
 * Runs on the server so the auth check happens before any HTML is sent to the
 * browser — unauthenticated users are redirected instantly with no flash.
 * The actual UI is rendered by ProfileContent (client component) which reads
 * the session again via useAuth() to populate the form fields.
 */
export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  return <ProfileContent />;
}
