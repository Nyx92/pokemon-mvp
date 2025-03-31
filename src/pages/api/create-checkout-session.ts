// /pages/api/create-checkout-session.ts
import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

// The ! at the end tells TypeScript that this value will not be undefined.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // If the Checkout session is created successfully, the session URL is sent back to the frontend in the response.
  if (req.method === "POST") {
    const { formData } = req.body;

    try {
      console.log("FormData Received for Checkout Session:", formData); // Log formData before using it

      // A Checkout session is a Stripe object that represents a payment flow. It generates a URL where the user can complete the payment.
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: "MC Document Generation" },
              unit_amount: 1000, // $10 in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        // add the session_id to the success URL: This ensures that the Stripe session ID is available in the query parameters when the user is redirected to the /success page.
        // This special placeholder ({CHECKOUT_SESSION_ID}) is automatically replaced by Stripe with the actual session ID when redirecting the user.
        metadata: {
          formData: JSON.stringify(formData), // Store form data securely in Stripe
        },
        // success_url: `${
        //   req.headers.origin
        //   // embed the form data within the success url so we can access it on successful payment
        // }/success?formData=${encodeURIComponent(JSON.stringify(formData))}`,
        // cancel_url: `${req.headers.origin}/`,
        success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/`,
      });

      // session URL is sent back. The frontend will use this URL to redirect the user to the Stripe Checkout page.
      res.status(200).json({ url: session.url });
    } catch (err) {
      console.error("Error creating Stripe session:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  } else {
    // If the request method is not POST, this block sends a 405 Method Not Allowed response.
    res.setHeader("Allow", "POST");
    res.status(405).end("Method Not Allowed");
  }
}
