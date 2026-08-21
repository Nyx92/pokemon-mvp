// src/lib/concurrency.ts
//
// Runs `fn` over `items` with at most `limit` running at once. Plain
// `Promise.all(items.map(fn))` starts every call simultaneously — fine for
// a handful of items, but firing off hundreds of concurrent downloads/
// uploads at once (e.g. seeding ~1300 card images) risks overwhelming the
// source, the destination, or both. A rejection from one item is captured
// rather than thrown — every item still runs to completion, and the caller
// decides what to do with failures instead of the whole batch aborting.

export interface ConcurrencyResult<T> {
  index: number;
  item: T;
  status: "fulfilled" | "rejected";
  value?: unknown;
  reason?: unknown;
}

export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<unknown>
): Promise<ConcurrencyResult<T>[]> {
  const results: ConcurrencyResult<T>[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      const item = items[index];
      try {
        const value = await fn(item, index);
        results[index] = { index, item, status: "fulfilled", value };
      } catch (reason) {
        results[index] = { index, item, status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}
