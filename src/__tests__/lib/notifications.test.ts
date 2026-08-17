import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  notification: { create: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const mockSendEmailAsync = vi.hoisted(() => vi.fn());
const mockBuildNotificationEmail = vi.hoisted(() =>
  vi.fn((title: string, body: string) => `<p>${title}: ${body}</p>`)
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email", () => ({
  sendEmailAsync: mockSendEmailAsync,
  buildNotificationEmail: mockBuildNotificationEmail,
}));

import { createNotification, notifyAsync } from "@/lib/notifications";

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.notification.create.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({ email: "seller@test.com" });
  });

  // What's being tested: the actual bug this task fixes. The Notification
  // model's foreign key column is `listingId` (renamed from `cardId` when
  // Card became Listing), but this function's own external parameter is
  // still named `cardId` for backward compatibility with its many callers.
  // The internal Prisma write must map one to the other.
  it("writes the card id to the Notification model's listingId column", async () => {
    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Your card was sold",
      body: "body text",
      cardId: "listing-1",
      orderId: "order-1",
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "card_sold",
        title: "Your card was sold",
        body: "body text",
        offerId: undefined,
        listingId: "listing-1",
        orderId: "order-1",
      },
    });
  });

  it("sends an email to the recipient when they have one on file", async () => {
    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Sold!",
      body: "text",
      cardId: "listing-1",
    });

    expect(mockSendEmailAsync).toHaveBeenCalledWith(
      expect.objectContaining({ to: "seller@test.com", subject: "Sold!" })
    );
  });

  it("skips sending an email when the recipient has none on file", async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ email: null });

    await createNotification({
      userId: "user-1",
      type: "card_sold",
      title: "Sold!",
      body: "text",
    });

    expect(mockSendEmailAsync).not.toHaveBeenCalled();
  });
});

describe("notifyAsync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never throws even when the DB write fails", async () => {
    mockPrisma.notification.create.mockRejectedValue(new Error("db down"));

    expect(() =>
      notifyAsync({ userId: "user-1", type: "card_sold", title: "t", body: "b" })
    ).not.toThrow();

    await new Promise((r) => setTimeout(r, 0));
  });
});
