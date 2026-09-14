import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { MAX_VERIFICATION_ATTEMPTS, verificationCodeMatches } from "@/lib/verificationCode";

/**
 * POST /api/user/verify/phone/confirm
 *
 * Body: { code: string }
 *
 * Verifies the 6-digit code sent by POST /api/user/verify/phone/request.
 * Same attempt-lockout logic as the email confirm route — see
 * src/app/api/user/verify/email/confirm/route.ts.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  // 🔒 Rate limit confirm attempts by user id. In-memory stopgap (see
  // src/lib/rateLimit.ts).
  const { allowed } = checkRateLimit(`phone-verify-confirm:${userId}`, {
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        phoneVerificationCodeHash: true,
        phoneVerificationCodeExpiresAt: true,
        phoneVerificationAttempts: true,
      },
    });

    if (!user?.phoneVerificationCodeHash || !user.phoneVerificationCodeExpiresAt) {
      return NextResponse.json({ error: "No verification code was requested" }, { status: 400 });
    }
    if (user.phoneVerificationCodeExpiresAt < new Date()) {
      return NextResponse.json({ error: "Code has expired. Request a new one." }, { status: 400 });
    }
    if (user.phoneVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Request a new code." },
        { status: 400 }
      );
    }

    if (!verificationCodeMatches(code, user.phoneVerificationCodeHash)) {
      await prisma.user.update({
        where: { id: userId },
        data: { phoneVerificationAttempts: { increment: 1 } },
      });
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        phoneVerificationCodeHash: null,
        phoneVerificationCodeExpiresAt: null,
        phoneVerificationAttempts: 0,
      },
    });

    return NextResponse.json({ message: "Phone number verified." });
  } catch (err) {
    console.error("[user/verify/phone/confirm] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
