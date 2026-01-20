import Stripe from "stripe";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string };
}) {
  const sessionId = searchParams.session_id;
  if (!sessionId) redirect("/profile/purchases?success=1");

  // Optional: verify session exists (server-side)
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Redirect to purchases page with a banner + session id
  redirect(
    `/profile/purchases?success=1&session_id=${encodeURIComponent(session.id)}`
  );
}
