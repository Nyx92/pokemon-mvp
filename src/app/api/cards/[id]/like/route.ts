import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST /api/cards/[id]/like — toggle like for the current user
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cardId = params.id;
  const userId = session.user.id;

  const existing = await prisma.cardLike.findUnique({
    where: { cardId_userId: { cardId, userId } },
  });

  if (existing) {
    await prisma.cardLike.delete({ where: { id: existing.id } });
  } else {
    await prisma.cardLike.create({ data: { cardId, userId } });
  }

  const count = await prisma.cardLike.count({ where: { cardId } });

  return NextResponse.json({ liked: !existing, count });
}
