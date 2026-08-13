import { describe, it, expect, vi } from "vitest";
import { verifyPaymentIntentAmountOrRespond } from "@/lib/paymentIntentGuard";

/**
 * verifyPaymentIntentAmountOrRespond — the PI-amount cross-check that closes
 * the price-tampering bug fixed in commit 8401551. Previously hand-copied
 * identically into offers/route.ts and bid/route.ts; extracted here so a
 * future payment-accepting route can reuse it instead of hand-copying a
 * third time (and risking getting it wrong).
 */

function fakeStripe(cancelImpl: () => Promise<any> = () => Promise.resolve({})) {
  return { paymentIntents: { cancel: vi.fn(cancelImpl) } } as any;
}

describe("verifyPaymentIntentAmountOrRespond", () => {
  it("returns null when the authorised amount matches the claimed amount", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 5000, "Offer");
    expect(result).toBeNull();
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it("cancels the PI and returns a 400 NextResponse when amounts mismatch", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Offer");
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith("pi_123");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(400);
    const body = await result!.json();
    expect(body.error).toBe("Offer amount does not match the authorised payment amount");
  });

  it("uses the entity label in the error message for bids", async () => {
    const stripe = fakeStripe();
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Bid");
    const body = await result!.json();
    expect(body.error).toBe("Bid amount does not match the authorised payment amount");
  });

  it("still returns the 400 response even if cancelling the mismatched PI fails", async () => {
    const stripe = fakeStripe(() => Promise.reject(new Error("already cancelled")));
    const result = await verifyPaymentIntentAmountOrRespond(stripe, "pi_123", 5000, 9999, "Offer");
    expect(result!.status).toBe(400);
  });
});
