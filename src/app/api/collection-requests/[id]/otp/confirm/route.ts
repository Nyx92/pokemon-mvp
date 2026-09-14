import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { MAX_VERIFICATION_ATTEMPTS, verificationCodeMatches } from "@/lib/verificationCode";

/**
 * POST /api/collection-requests/[id]/otp/confirm
 *
 * Body: { code: string }
 *
 * Verifies the code sent by .../otp/request. On success, marks the request
 * (and every card in it) COLLECTED — the cards then disappear from "My
 * Collection" (GET /api/user/cards excludes collectedAt-not-null listings)
 * without ever deleting the rows, same "flag, don't delete" principle
 * every sale path in this codebase already follows.
 *
 * Same attempt-lockout logic as the email/phone confirm routes — see
 * src/app/api/user/verify/email/confirm/route.ts.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const { allowed } = checkRateLimit(`collection-otp-confirm:${userId}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const request = await prisma.collectionRequest.findUnique({ where: { id: params.id } });
    if (!request || request.userId !== userId) {
      return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
    }
    if (request.status === "COLLECTED") {
      return NextResponse.json({ error: "This pickup has already been collected" }, { status: 409 });
    }
    if (!request.pickupCodeHash || !request.pickupCodeExpiresAt) {
      return NextResponse.json({ error: "No verification code was requested" }, { status: 400 });
    }
    if (request.pickupCodeExpiresAt < new Date()) {
      return NextResponse.json({ error: "Code has expired. Request a new one." }, { status: 400 });
    }
    if (request.pickupCodeAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code." },
        { status: 400 }
      );
    }

    if (!verificationCodeMatches(code, request.pickupCodeHash)) {
      await prisma.collectionRequest.update({
        where: { id: request.id },
        data: { pickupCodeAttempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }

    const collectedAt = new Date();
    await prisma.$transaction([
      prisma.collectionRequest.update({
        where: { id: request.id },
        data: {
          status: "COLLECTED",
          collectedAt,
          pickupCodeHash: null,
          pickupCodeExpiresAt: null,
          pickupCodeAttempts: 0,
        },
      }),
      prisma.listing.updateMany({
        where: { collectionRequestId: request.id },
        data: { collectedAt },
      }),
    ]);

    return NextResponse.json({ message: "Pickup confirmed — enjoy your cards!" });
  } catch (err) {
    console.error("[collection-requests/otp/confirm] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
