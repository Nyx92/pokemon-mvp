import type { Metadata } from "next";
import Stripe from "stripe";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-02-24.acacia",
});

// Private post-checkout page — robots.ts already disallows /checkout, this
// is defense in depth in case a search engine ever crawls it directly.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage(
  props: {
    searchParams: Promise<{ session_id?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const sessionId = searchParams.session_id;
  // No session id — redirect to transactions page with success banner
  if (!sessionId) redirect("/purchases?success=1");

  // Verify the Stripe session exists (server-side guard against spoofed IDs)
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Redirect to the Purchases tab of Transaction History with:
  //   - success=1 → shows the success banner
  //   - session_id → available for future use (e.g. highlighting the specific order)
  redirect(
    `/purchases?success=1&session_id=${encodeURIComponent(session.id)}`
  );
}
