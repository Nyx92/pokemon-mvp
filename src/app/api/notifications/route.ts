/**
 * GET  /api/notifications  — list the current user's notifications, newest first.
 * PATCH /api/notifications  — bulk mark all notifications as read.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET ───────────────────────────────────────────────────────────────────────
// Returns all notifications for the current user ordered newest-first.
// The client uses this to populate the /notifications page.

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("[api/notifications GET] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
// Marks all unread notifications as read for the current user.
// Called by the "Mark all read" button on the notifications page.

export async function PATCH(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { count } = await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });

    return NextResponse.json({ updated: count });
  } catch (err) {
    console.error("[api/notifications PATCH] error:", err);
    return NextResponse.json(
      { error: "Failed to mark notifications as read" },
      { status: 500 }
    );
  }
}
