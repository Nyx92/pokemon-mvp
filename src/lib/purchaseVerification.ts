// src/lib/purchaseVerification.ts
//
// Shared "is this buyer allowed to commit money" gate. Every route that
// creates a Stripe Checkout Session or a manual-capture PaymentIntent (buy
// now, cart checkout, making an offer, placing a bid) must call this right
// after confirming the caller is authenticated, and bail out on the
// returned response if verification isn't complete.
//
// Reads straight from the DB rather than the session/JWT so a code
// confirmed moments ago is honored immediately, without waiting for the
// client to call useSession().update() and the JWT to refresh.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function requireVerifiedForPurchase(userId: string): Promise<NextResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, phoneVerified: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (!user.emailVerified || !user.phoneVerified) {
    return NextResponse.json(
      {
        error: "Verify your email and phone number before making a purchase.",
        emailVerified: !!user.emailVerified,
        phoneVerified: user.phoneVerified,
      },
      { status: 403 }
    );
  }

  return null;
}
