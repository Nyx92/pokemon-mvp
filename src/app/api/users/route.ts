// app/api/users/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// The only consumer of this route is the admin "assign owner" dropdown in
// /upload (UploadCard.tsx) — it needs every user's id/username/email to let
// an admin pick who a newly listed card belongs to. That's an admin-only
// need, so the route is restricted to admins rather than being public.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true },
      orderBy: { username: "asc" },
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("❌ Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
