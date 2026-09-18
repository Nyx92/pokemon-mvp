import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { postCronResult } from "@/lib/discord";

/**
 * postCronResult posts a Discord alert for the two price-sync cron jobs, on
 * every run — success or failure. Silent no-op when
 * DISCORD_CRON_ALERTS_WEBHOOK_URL isn't set, matching the existing
 * DISCORD_WEBHOOK_URL convention. global.fetch is mocked — no real network call.
 */
describe("postCronResult", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, text: async () => "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("does not call fetch when DISCORD_CRON_ALERTS_WEBHOOK_URL is unset", async () => {
    vi.stubEnv("DISCORD_CRON_ALERTS_WEBHOOK_URL", "");
    await postCronResult({ job: "refresh-prices", ok: true, summary: "Raw: 10, Graded: 2, Failed: 0" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts a green embed titled with the job name on success", async () => {
    vi.stubEnv("DISCORD_CRON_ALERTS_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    await postCronResult({ job: "refresh-prices", ok: true, summary: "Raw: 10, Graded: 2, Failed: 0" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe("✅ refresh-prices");
    expect(body.embeds[0].description).toBe("Raw: 10, Graded: 2, Failed: 0");
    expect(body.embeds[0].color).toBe(0x22c55e);
    expect(body.embeds[0].fields).toBeUndefined();
  });

  it("posts a red embed with an errors field on failure", async () => {
    vi.stubEnv("DISCORD_CRON_ALERTS_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    await postCronResult({
      job: "backfill-prices",
      ok: false,
      summary: "Backfilled: 8, Failed: 2, Remaining: 40",
      errors: ["Pokemon card abc: JustTCG request failed: 500", "Pokemon card def: timeout"],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].title).toBe("❌ backfill-prices");
    expect(body.embeds[0].color).toBe(0xef4444);
    expect(body.embeds[0].fields[0].value).toContain("JustTCG request failed: 500");
  });

  it("caps the errors field at 10 entries", async () => {
    vi.stubEnv("DISCORD_CRON_ALERTS_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    const errors = Array.from({ length: 20 }, (_, i) => `card-${i}: failed`);
    await postCronResult({ job: "backfill-prices", ok: false, summary: "Failed: 20", errors });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.embeds[0].fields[0].value.split("\n")).toHaveLength(10);
  });

  it("does not throw when the Discord API call itself fails", async () => {
    vi.stubEnv("DISCORD_CRON_ALERTS_WEBHOOK_URL", "https://discord.com/api/webhooks/test");
    mockFetch.mockRejectedValue(new Error("network down"));
    await expect(
      postCronResult({ job: "refresh-prices", ok: true, summary: "ok" })
    ).resolves.toBeUndefined();
  });
});
