/**
 * PATCH  /api/notifications/[id]  — mark a single notification as read.
 * DELETE /api/notifications/[id]  — dismiss (delete) a single notification.
 *
 * Both operations are scoped to the current user — a user can only act on
 * their own notifications.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── PATCH — mark as read ──────────────────────────────────────────────────────

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    // updateMany with userId guard prevents users from marking someone else's
    // notification as read (safe alternative to findUnique + ownership check).
    const { count } = await prisma.notification.updateMany({
      where: { id: params.id, userId },
      data: { read: true },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/notifications/[id] PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

// ── DELETE — dismiss ──────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { count } = await prisma.notification.deleteMany({
      where: { id: params.id, userId },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/notifications/[id] DELETE] error:", err);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
