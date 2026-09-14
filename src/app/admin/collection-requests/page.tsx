import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AdminCollectionRequests from "./AdminCollectionRequests";

// Staff-only page — kept out of search results, same as /profile.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /admin/collection-requests — staff view of open in-person pickup
 * requests, so cards can be packed in advance of the customer arriving.
 *
 * Runs on the server so the role check happens before any HTML is sent —
 * unauthenticated or non-admin users are redirected instantly with no flash.
 */
export default async function AdminCollectionRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin") redirect("/");

  return <AdminCollectionRequests />;
}
