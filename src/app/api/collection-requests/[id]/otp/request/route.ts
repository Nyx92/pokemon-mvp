import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { normalizePhoneNumber } from "@/lib/phone";
import {
  VERIFICATION_CODE_TTL_MS,
  generateVerificationCode,
  hashVerificationCode,
} from "@/lib/verificationCode";

/**
 * POST /api/collection-requests/[id]/otp/request
 *
 * Sends a 6-digit code to the caller's own (already phone-verified) number
 * so they can confirm their identity in-store before staff release the
 * cards — see src/lib/verificationCode.ts for the hash-only storage
 * rationale, shared with the email/phone verification flow this reuses.
 *
 * Only allowed once staff have marked the request PACKED — there's nothing
 * to collect yet before that.
 *
 * Rate limited by both user id and IP — a paid Twilio/SNS send on every call.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = getClientIp(req);
  const userLimit = checkRateLimit(`collection-otp-request:user:${userId}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  const ipLimit = checkRateLimit(`collection-otp-request:ip:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
  if (!userLimit.allowed || !ipLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const request = await prisma.collectionRequest.findUnique({ where: { id: params.id } });
    if (!request || request.userId !== userId) {
      return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
    }
    if (request.status === "COLLECTED") {
      return NextResponse.json({ error: "This pickup has already been collected" }, { status: 409 });
    }
    if (request.status !== "PACKED") {
      return NextResponse.json(
        { error: "This pickup isn't ready yet — wait for staff to pack it first" },
        { status: 409 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true, phoneVerified: true },
    });
    if (!user?.phoneNumber || !user.phoneVerified) {
      return NextResponse.json(
        { error: "Verify your phone number in Edit Profile before collecting in person." },
        { status: 400 }
      );
    }

    const code = generateVerificationCode();
    await prisma.collectionRequest.update({
      where: { id: request.id },
      data: {
        pickupCodeHash: hashVerificationCode(code),
        pickupCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
        pickupCodeAttempts: 0,
      },
    });

    // No isValidE164 re-check here (unlike POST /api/user/verify/phone/request):
    // phoneVerified is only ever set true after that route's own validation
    // passed for this exact number, and PUT /api/user resets it to false the
    // moment the number changes — so requiring phoneVerified above already
    // guarantees the number on file is valid.
    const { success, error } = await sendSms({
      to: normalizePhoneNumber(user.phoneNumber),
      body: `Your MXYYC pickup code for ${request.requestRef} is ${code}. It expires in 10 minutes.`,
    });
    if (!success) {
      console.error("[collection-requests/otp/request] SMS send failed:", error);
      return NextResponse.json({ error: "Failed to send the code. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ message: "Verification code sent." });
  } catch (err) {
    console.error("[collection-requests/otp/request] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
