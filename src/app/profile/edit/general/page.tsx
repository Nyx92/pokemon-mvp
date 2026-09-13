// app/profile/edit/general/page.tsx
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import EditProfilePage from "./EditProfilePage";

// Private account page — robots.ts already disallows /profile, this is
// defense in depth in case a search engine ever crawls it directly.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function EditProfile() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  // ✅ Pass SSR user data to client component
  return <EditProfilePage />;
}
