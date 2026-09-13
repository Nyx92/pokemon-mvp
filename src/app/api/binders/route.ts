// src/app/api/binders/route.ts
//
// Two operations on the current user's binders (My Collection's organizing
// folders for listings — see the Binder model in schema.prisma):
//
//   GET  /api/binders   → list the user's binders (used to populate the
//                          binder dropdown, including ones with zero cards —
//                          MyCollection.tsx can't derive those from the
//                          card list alone)
//   POST /api/binders   → create a new, empty binder owned by the user

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const binders = await prisma.binder.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ binders });
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Binder name is required" }, { status: 400 });
  }

  const userId = session.user.id;

  // Same "no duplicate binder name" rule the old client-only implementation
  // enforced (it compared slugified ids) — checked here case-insensitively
  // now that binder names are real, shared-across-devices rows.
  const existing = await prisma.binder.findFirst({
    where: { userId, name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return NextResponse.json({ error: "Binder name already exists" }, { status: 400 });
  }

  const binder = await prisma.binder.create({
    data: { name, userId },
    select: { id: true, name: true },
  });

  return NextResponse.json({ binder }, { status: 201 });
}
