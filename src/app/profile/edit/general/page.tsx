// app/profile/edit/general/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import EditProfilePage from "./EditProfilePage";

export default async function EditProfile() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/login");
  }

  // ✅ Pass SSR user data to client component
  return <EditProfilePage initialUser={session.user} />;
}
