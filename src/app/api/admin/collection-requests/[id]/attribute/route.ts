import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/collection-requests/[id]/attribute — staff only.
 *
 * Records which admin confirms they physically handed the cards over.
 * Internal record-keeping only — re-calling it re-attributes to whoever
 * calls it last; there's no security boundary to protect here, just a note.
 */
export async function POST(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const request = await prisma.collectionRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }
  if (request.status !== "COLLECTED") {
    return NextResponse.json({ error: "This request hasn't been collected yet" }, { status: 400 });
  }

  await prisma.collectionRequest.update({
    where: { id },
    data: { collectedByStaffId: session.user.id },
  });

  return NextResponse.json({
    collectedByStaff: { id: session.user.id, username: session.user.username ?? null },
  });
}
