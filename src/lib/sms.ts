/**
 * sms.ts — thin wrapper for sending transactional SMS (phone verification
 * codes), mirroring the shape of src/lib/email.ts.
 *
 * Unlike email.ts's sendEmailAsync (fire-and-forget, used for non-critical
 * notifications), sendSms() here is awaited — a verification code is the
 * entire point of the request, so the caller needs to know delivery failed
 * and report that back to the user instead of silently leaving them
 * waiting for a text that never arrives.
 *
 * Environment variables:
 *   SMS_PROVIDER                 — "aws" (default) or "twilio"
 *   SMS_DEV_MODE                 — "true" logs to console instead of sending
 *                                  (useful in local dev, avoids burning paid
 *                                  Twilio/SNS sends while iterating)
 *   TWILIO_ACCOUNT_SID           — required when SMS_PROVIDER=twilio
 *   TWILIO_AUTH_TOKEN            — required when SMS_PROVIDER=twilio
 *   TWILIO_MESSAGING_SERVICE_SID — required when SMS_PROVIDER=twilio
 *   AWS_REGION                   — used when SMS_PROVIDER=aws (default
 *                                  "us-east-1"); credentials come from the
 *                                  standard AWS SDK provider chain (env vars
 *                                  / IAM role), never hardcoded here.
 */

export interface SendSmsOptions {
  to: string;
  body: string;
}

export interface SendSmsResult {
  success: boolean;
  error?: string;
}

const SMS_PROVIDER = (process.env.SMS_PROVIDER ?? "aws").toLowerCase();
const SMS_DEV_MODE = process.env.SMS_DEV_MODE === "true";

export async function sendSms(opts: SendSmsOptions): Promise<SendSmsResult> {
  if (SMS_DEV_MODE) {
    console.log(`[sms:dev-mode] to=${opts.to} body="${opts.body}"`);
    return { success: true };
  }

  try {
    if (SMS_PROVIDER === "twilio") {
      await sendViaTwilio(opts);
    } else if (SMS_PROVIDER === "aws") {
      await sendViaAwsSns(opts);
    } else {
      throw new Error(`Unknown SMS_PROVIDER "${SMS_PROVIDER}" — expected "aws" or "twilio"`);
    }
    return { success: true };
  } catch (err) {
    console.error("[sms] Failed to send to", opts.to, err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Twilio ───────────────────────────────────────────────────────────────────

async function sendViaTwilio(opts: SendSmsOptions): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!accountSid || !authToken || !messagingServiceSid) {
    throw new Error(
      "Twilio is not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MESSAGING_SERVICE_SID"
    );
  }

  // Lazy import — keeps the twilio SDK (and its network/client setup) out of
  // the module graph entirely for deployments that only ever use SMS_PROVIDER=aws.
  const { default: Twilio } = await import("twilio");
  const client = Twilio(accountSid, authToken);

  await client.messages.create({
    to: opts.to,
    messagingServiceSid,
    body: opts.body,
  });
}

// ── AWS SNS ──────────────────────────────────────────────────────────────────

async function sendViaAwsSns(opts: SendSmsOptions): Promise<void> {
  const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");
  const client = new SNSClient({ region: process.env.AWS_REGION ?? "us-east-1" });

  await client.send(
    new PublishCommand({
      PhoneNumber: opts.to,
      Message: opts.body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType: "String",
          // "Transactional" prioritizes delivery reliability over cost —
          // correct for OTP codes, which are useless if delayed.
          StringValue: "Transactional",
        },
      },
    })
  );
}
