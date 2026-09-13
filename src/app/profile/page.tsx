import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ProfileContent from "./ProfileContent";

// Private account page — robots.ts already disallows /profile, this is
// defense in depth in case a search engine ever crawls it directly.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
