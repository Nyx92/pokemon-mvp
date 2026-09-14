import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * src/lib/sms.ts — provider switch (twilio/aws) + dev-mode logging.
 * Twilio/AWS SDK calls are lazy-imported inside the module, so they're
 * mocked at the package level rather than needing the module under test
 * to be re-imported per test.
 */

const mockTwilioCreate = vi.hoisted(() => vi.fn().mockResolvedValue({ sid: "SM123" }));
const mockTwilioClient = vi.hoisted(() => vi.fn(() => ({ messages: { create: mockTwilioCreate } })));
const mockSnsSend = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("twilio", () => ({ default: mockTwilioClient }));
vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: vi.fn(() => ({ send: mockSnsSend })),
  PublishCommand: vi.fn((input) => input),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("sendSms", () => {
  it("logs to console and skips sending when SMS_DEV_MODE=true", async () => {
    process.env.SMS_DEV_MODE = "true";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const { sendSms } = await import("@/lib/sms");
    const result = await sendSms({ to: "+6591234567", body: "code 123456" });

    expect(result).toEqual({ success: true });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("+6591234567"));
    expect(mockTwilioCreate).not.toHaveBeenCalled();
    expect(mockSnsSend).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("sends via Twilio when SMS_PROVIDER=twilio", async () => {
    process.env.SMS_DEV_MODE = "false";
    process.env.SMS_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_MESSAGING_SERVICE_SID = "MG123";

    const { sendSms } = await import("@/lib/sms");
    const result = await sendSms({ to: "+6591234567", body: "code 123456" });

    expect(result).toEqual({ success: true });
    expect(mockTwilioCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: "+6591234567", messagingServiceSid: "MG123", body: "code 123456" })
    );
    expect(mockSnsSend).not.toHaveBeenCalled();
  });

  it("returns a failure result (not a throw) when Twilio isn't configured", async () => {
    process.env.SMS_DEV_MODE = "false";
    process.env.SMS_PROVIDER = "twilio";
    delete process.env.TWILIO_ACCOUNT_SID;

    const { sendSms } = await import("@/lib/sms");
    const result = await sendSms({ to: "+6591234567", body: "code 123456" });

    expect(result.success).toBe(false);
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });

  it("sends via AWS SNS when SMS_PROVIDER=aws (the default)", async () => {
    process.env.SMS_DEV_MODE = "false";
    delete process.env.SMS_PROVIDER;

    const { sendSms } = await import("@/lib/sms");
    const result = await sendSms({ to: "+6591234567", body: "code 123456" });

    expect(result).toEqual({ success: true });
    expect(mockSnsSend).toHaveBeenCalledTimes(1);
    expect(mockTwilioCreate).not.toHaveBeenCalled();
  });
});
