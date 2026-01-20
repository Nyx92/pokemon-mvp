// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { cardId, title, price, imageUrls, buyerId } = body as {
      cardId: string;
      title: string;
      price: number;
      imageUrls?: string[];
      buyerId?: string;
    };

    if (!price || price <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const finalImageUrls =
      imageUrls
        ?.filter(Boolean)
        .map((url) => (url.startsWith("http") ? url : `${baseUrl}${url}`)) ??
      [];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            unit_amount: Math.round(price * 100),
            product_data: {
              name: title,
              images: finalImageUrls,
              metadata: { cardId },
            },
          },
          quantity: 1,
        },
      ],
      // ✅ success page can read the session_id
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      // ✅ cancel should return them to the card page (or a cancel page)
      cancel_url: `${baseUrl}/checkout/cancel?cardId=${encodeURIComponent(cardId)}`,
      metadata: {
        cardId,
        ...(buyerId ? { buyerId } : {}),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe] Error creating checkout session:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
