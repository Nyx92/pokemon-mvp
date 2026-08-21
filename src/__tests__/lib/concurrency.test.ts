import { describe, it, expect, vi } from "vitest";
import { mapWithConcurrency } from "@/lib/concurrency";

describe("mapWithConcurrency", () => {
  it("runs every item and returns fulfilled results in original order", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => n * 10);

    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "fulfilled"]);
    expect(results.map((r) => r.value)).toEqual([10, 20, 30]);
    expect(results.map((r) => r.item)).toEqual([1, 2, 3]);
  });

  it("never runs more than `limit` calls concurrently", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("continues past a rejection instead of aborting the whole batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });

    expect(results[0]).toMatchObject({ status: "fulfilled", value: 1 });
    expect(results[1]).toMatchObject({ status: "rejected" });
    expect((results[1].reason as Error).message).toBe("boom");
    expect(results[2]).toMatchObject({ status: "fulfilled", value: 3 });
  });

  it("handles limit greater than the number of items", async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (n) => n);
    expect(results.map((r) => r.value)).toEqual([1, 2]);
  });

  it("handles an empty items array without calling fn", async () => {
    const fn = vi.fn();
    const results = await mapWithConcurrency([], 5, fn);
    expect(results).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });
});
