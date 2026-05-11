/**
 * notifications.ts — central helper for creating in-app notifications.
 *
 * Every notification trigger in the app (offer placed, accepted, rejected,
 * card sold) calls notifyAsync() from this file. It:
 *   1. Writes a Notification row to the DB (for the in-app bell).
 *   2. Looks up the recipient's email and sends a transactional email via
 *      Resend — fire-and-forget, never blocks the calling request.
 *
 * notifyAsync() itself is also fire-and-forget: it never throws and never
 * blocks. A failure is logged but does not affect the core transaction
 * (order creation, card transfer, etc.).
 *
 * Notification types:
 *   offer_received  — seller: someone placed an offer on your card
 *   offer_accepted  — buyer:  your offer was accepted
 *   offer_rejected  — buyer:  your offer was declined
 *   card_sold       — seller: your card was purchased via Buy Now
 */

import { prisma } from "@/lib/prisma";
import { sendEmailAsync, buildNotificationEmail } from "@/lib/email";

export type NotificationType =
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "card_sold";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  offerId?: string;
  cardId?: string;
  orderId?: string;
}

// Creates the DB record and fires the email. Awaitable if you need to be sure
// the DB write succeeded — though most callers use notifyAsync() instead.
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  const { userId, type, title, body, offerId, cardId, orderId } = input;

  // Step 1: Persist the notification so it appears in the bell/page.
  await prisma.notification.create({
    data: { userId, type, title, body, offerId, cardId, orderId },
  });

  // Step 2: Look up the recipient's email and send — fire-and-forget.
  // We fetch the email here so callers don't need to pass it; the extra
  // DB round-trip is acceptable because this whole function is async side-effect.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (user?.email) {
    sendEmailAsync({
      to: user.email,
      subject: title,
      html: buildNotificationEmail(title, body),
    });
  }
}

// Fire-and-forget wrapper — use this in request handlers and webhooks so
// a notification failure never surfaces as a 500 to the caller.
export function notifyAsync(input: CreateNotificationInput): void {
  createNotification(input).catch((err) => {
    console.error("[notifications] Failed to create notification:", err);
  });
}
