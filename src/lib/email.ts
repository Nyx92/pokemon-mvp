/**
 * email.ts — thin Resend wrapper for sending transactional emails.
 *
 * Usage:
 *   sendEmailAsync({ to, subject, html })
 *
 * Always fire-and-forget — never awaited in request handlers so email
 * failures never block or slow down API responses. Errors are logged only.
 *
 * Environment variables required:
 *   RESEND_API_KEY   — from resend.com dashboard
 *   FROM_EMAIL       — verified sender address, e.g. "MXYYC <noreply@mxyyc.com>"
 *                      Defaults to Resend's test address while in development.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use your verified domain in production. Resend's onboarding address works
// for testing without domain verification.
const FROM = process.env.FROM_EMAIL ?? "MXYYC <onboarding@resend.dev>";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Fire-and-forget — never throws, just logs on failure.
export function sendEmailAsync(opts: SendEmailOptions): void {
  resend.emails
    .send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
    .catch((err) => {
      console.error("[email] Failed to send to", opts.to, err);
    });
}

// ── HTML email template ───────────────────────────────────────────────────────
// Simple inline-styled layout — works across all major email clients.

export function buildNotificationEmail(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:20px 32px;">
            <span style="font-size:18px;font-weight:700;color:#ffffff;
                         letter-spacing:0.04em;">MXYYC</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">${title}</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              ${body}
            </p>
            <a href="${SITE_URL}/notifications"
               style="display:inline-block;padding:11px 22px;background:#111827;
                      color:#ffffff;border-radius:8px;text-decoration:none;
                      font-size:14px;font-weight:600;">
              View notification
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              You're receiving this because you have an account on MXYYC Marketplace.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
