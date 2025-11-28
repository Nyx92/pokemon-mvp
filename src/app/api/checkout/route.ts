// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { cardId, title, price, imageUrl } = body as {
      cardId: string;
      title: string;
      price: number;
      imageUrl?: string;
    };

    if (!price || price <= 0) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // Automatically pick base URL based on env
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Stripe requires absolute URL
    const finalImageUrl =
      imageUrl && !imageUrl.startsWith("http")
        ? `${baseUrl}${imageUrl}`
        : imageUrl;

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
              images: finalImageUrl ? [finalImageUrl] : [],
              metadata: {
                cardId,
              },
            },
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        cardId,
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
