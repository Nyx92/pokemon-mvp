# Post-Collection Admin View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give staff a "Completed" view of collected pickups and a way to attribute who handled the handover, without touching the customer-facing pickup flow or deleting/relocating any data.

**Architecture:** One new nullable field + relation on `CollectionRequest`/`User`. The existing admin GET route gains a `?status=` query param instead of a hardcoded filter. One new admin-only POST route sets the attribution. The existing admin page component gains a second tab reusing its current card-list rendering.

**Tech Stack:** Next.js App Router API routes, Prisma, NextAuth (`getServerSession`), MUI, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-post-collection-archival-design.md`

## Global Constraints

- Never delete or move `CollectionRequest`/`Listing` rows — flag only, matching the existing "flag, don't delete" pattern.
- `POST /api/collection-requests/[id]/otp/confirm` (the customer pickup flow) is not touched by this plan.
- Admin auth check is `session.user.role !== "admin"` → 403, matching every existing admin route.
- Schema changes are pushed with `pnpm exec prisma db push` (this repo has no migrations folder).

---

### Task 1: Schema — staff attribution field

**Files:**
- Modify: `prisma/schema.prisma` (`CollectionRequest` model, `User` model)

**Interfaces:**
- Produces: `CollectionRequest.collectedByStaffId: string | null`, `CollectionRequest.collectedByStaff: User | null` (relation name `"CollectionHandovers"`)

- [ ] **Step 1: Add the field and relation to `CollectionRequest`**

In `prisma/schema.prisma`, inside `model CollectionRequest { ... }`, add after the existing `pickupCodeAttempts` field:

```prisma
  // Staff attestation: which admin confirmed they physically handed the
  // cards over. Set by a separate, optional admin action — never by the
  // customer's own OTP confirm, which has no staff session in it at all
  // (that route requires the caller to *be* the customer). Null until a
  // staff member attributes the handover to themselves; never required
  // to reach COLLECTED.
  collectedByStaff   User?   @relation("CollectionHandovers", fields: [collectedByStaffId], references: [id], onDelete: SetNull)
  collectedByStaffId String?
```

- [ ] **Step 2: Add the inverse relation to `User`**

In `model User { ... }`, add alongside the existing relation list (near `reservedListings`):

```prisma
  collectionHandovers CollectionRequest[] @relation("CollectionHandovers")
```

- [ ] **Step 3: Push the schema change**

Run: `pnpm exec prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` — no errors, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Add CollectionRequest.collectedByStaff for handover attribution"
```

---

### Task 2: `GET /api/admin/collection-requests` — add `?status=` param

**Files:**
- Modify: `src/app/api/admin/collection-requests/route.ts`
- Test: `src/__tests__/api/admin/collection-requests.test.ts`

**Interfaces:**
- Consumes: `OPEN_COLLECTION_STATUSES` from `@/lib/collectionRequests` (existing: `["REQUESTED", "PACKED"] as const`)
- Produces: `GET(req: Request)` — now reads `req.url`'s `status` query param (`"open"` default, or `"completed"`); response body gains `collectedByStaff: { id, username } | null` per request.

- [ ] **Step 1: Write the failing tests**

Add to `src/__tests__/api/admin/collection-requests.test.ts`, replacing the existing "queries only open statuses" test and adding two more:

```ts
  it("defaults to open statuses when no status param is given", async () => {
    await GET(new Request("http://localhost/api/admin/collection-requests"));
    expect(mockPrisma.collectionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["REQUESTED", "PACKED"] } },
        orderBy: { requestedAt: "asc" },
      })
    );
  });

  it("queries COLLECTED requests, newest first, when status=completed", async () => {
    await GET(new Request("http://localhost/api/admin/collection-requests?status=completed"));
    expect(mockPrisma.collectionRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "COLLECTED" },
        orderBy: { collectedAt: "desc" },
      })
    );
  });

  it("includes collectedByStaff in the response shape", async () => {
    mockPrisma.collectionRequest.findMany.mockResolvedValue([
      {
        id: "req-1", requestRef: "PU-2609-AAAA", status: "COLLECTED",
        requestedAt: new Date(), packedAt: new Date(), collectedAt: new Date(),
        collectedByStaff: { id: "admin-1", username: "staffuser" },
        user: { id: "user-1", username: "ash", firstName: "Ash", lastName: "Ketchum", email: "ash@example.com" },
        listings: [],
      },
    ]);
    const res = await GET(new Request("http://localhost/api/admin/collection-requests?status=completed"));
    const body = await res.json();
    expect(body.requests[0].collectedByStaff).toEqual({ id: "admin-1", username: "staffuser" });
  });
```

Also update the existing `beforeEach`'s call sites and the "returns 401"/"403"/"500" tests to pass `new Request("http://localhost/api/admin/collection-requests")` as the `GET` argument, since `GET` now takes a parameter.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test collection-requests.test.ts`
Expected: FAIL — `GET` doesn't accept a `Request` argument yet, and `collectedByStaff` isn't selected.

- [ ] **Step 3: Implement**

Replace `src/app/api/admin/collection-requests/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OPEN_COLLECTION_STATUSES } from "@/lib/collectionRequests";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";

/**
 * GET /api/admin/collection-requests?status=open|completed — staff only.
 *
 * status=open (default): REQUESTED/PACKED, oldest first — backs the
 * "pack in advance" workflow.
 * status=completed: COLLECTED, newest first — the record-keeping view,
 * including who (if anyone) attributed the handover to themselves.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status") === "completed" ? "completed" : "open";

  try {
    const requests = await prisma.collectionRequest.findMany({
      where: status === "completed" ? { status: "COLLECTED" } : { status: { in: [...OPEN_COLLECTION_STATUSES] } },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true, email: true } },
        collectedByStaff: { select: { id: true, username: true } },
        listings: { include: listingCatalogInclude },
      },
      orderBy: status === "completed" ? { collectedAt: "desc" } : { requestedAt: "asc" },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        requestRef: r.requestRef,
        status: r.status,
        requestedAt: r.requestedAt,
        packedAt: r.packedAt,
        collectedAt: r.collectedAt,
        collectedByStaff: r.collectedByStaff,
        customer: r.user,
        cards: r.listings.map((listing) => withListingDisplay(listing)),
      })),
    });
  } catch (err) {
    console.error("[admin/collection-requests] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test collection-requests.test.ts`
Expected: PASS, all tests including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/collection-requests/route.ts src/__tests__/api/admin/collection-requests.test.ts
git commit -m "Add status=open|completed to GET /api/admin/collection-requests"
```

---

### Task 3: `POST /api/admin/collection-requests/[id]/attribute`

**Files:**
- Create: `src/app/api/admin/collection-requests/[id]/attribute/route.ts`
- Test: `src/__tests__/api/admin/collection-requests-attribute.test.ts`

**Interfaces:**
- Consumes: `prisma.collectionRequest.findUnique`, `prisma.collectionRequest.update` (Prisma Client, already available via `@/lib/prisma`)
- Produces: `POST(req: NextRequest, props: { params: Promise<{ id: string }> })` → `{ collectedByStaff: { id, username } }` on success

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/api/admin/collection-requests-attribute.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockPrisma = vi.hoisted(() => ({
  collectionRequest: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockGetServerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "@/app/api/admin/collection-requests/[id]/attribute/route";

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/collection-requests/req-1/attribute", { method: "POST" });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: "admin-1", role: "admin", username: "staffuser" } });
});

describe("POST /api/admin/collection-requests/[id]/attribute", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-1", role: "user" } });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the request doesn't exist", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when the request isn't COLLECTED yet", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", status: "PACKED" });
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    expect(res.status).toBe(400);
    expect(mockPrisma.collectionRequest.update).not.toHaveBeenCalled();
  });

  it("sets collectedByStaffId to the calling admin and returns their info", async () => {
    mockPrisma.collectionRequest.findUnique.mockResolvedValue({ id: "req-1", status: "COLLECTED" });
    mockPrisma.collectionRequest.update.mockResolvedValue({});

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "req-1" }) });
    const body = await res.json();

    expect(mockPrisma.collectionRequest.update).toHaveBeenCalledWith({
      where: { id: "req-1" },
      data: { collectedByStaffId: "admin-1" },
    });
    expect(body.collectedByStaff).toEqual({ id: "admin-1", username: "staffuser" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test collection-requests-attribute.test.ts`
Expected: FAIL — route file doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/app/api/admin/collection-requests/[id]/attribute/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/collection-requests/[id]/attribute — staff only.
 *
 * Records which admin confirms they physically handed the cards over.
 * Internal record-keeping only — re-calling it re-attributes to whoever
 * calls it last; there's no security boundary to protect here, just a note.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const request = await prisma.collectionRequest.findUnique({ where: { id } });
  if (!request) {
    return NextResponse.json({ error: "Pickup request not found" }, { status: 404 });
  }
  if (request.status !== "COLLECTED") {
    return NextResponse.json({ error: "This request hasn't been collected yet" }, { status: 400 });
  }

  await prisma.collectionRequest.update({
    where: { id },
    data: { collectedByStaffId: session.user.id },
  });

  return NextResponse.json({
    collectedByStaff: { id: session.user.id, username: session.user.username ?? null },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test collection-requests-attribute.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/collection-requests/[id]/attribute/route.ts src/__tests__/api/admin/collection-requests-attribute.test.ts
git commit -m "Add POST /api/admin/collection-requests/[id]/attribute"
```

---

### Task 4: Admin UI — Completed tab

**Files:**
- Modify: `src/app/admin/collection-requests/AdminCollectionRequests.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/collection-requests?status=open|completed` (Task 2), `POST /api/admin/collection-requests/[id]/attribute` (Task 3)

- [ ] **Step 1: Add tab state and status-aware fetch**

In `AdminCollectionRequests.tsx`, add `Tabs, Tab` to the MUI import list, add state, and change `load` to take the current tab into account:

```tsx
import {
  Container, Typography, Box, Card, CardContent, Chip, Button,
  CircularProgress, Alert, Divider, Tabs, Tab,
} from "@mui/material";
```

Add near the other `useState` calls:

```tsx
  const [tab, setTab] = useState<"open" | "completed">("open");
  const [attributingId, setAttributingId] = useState<string | null>(null);
```

Update the `AdminCollectionRequest` interface to include the new fields:

```tsx
interface AdminCollectionRequest {
  id: string;
  requestRef: string;
  status: "REQUESTED" | "PACKED" | "COLLECTED";
  requestedAt: string;
  packedAt: string | null;
  collectedAt: string | null;
  collectedByStaff: { id: string; username: string | null } | null;
  customer: { username: string | null; firstName: string | null; email: string };
  cards: AdminCard[];
}
```

Change `load` to depend on `tab` and pass it to the fetch:

```tsx
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/collection-requests?status=${tab}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load pickup requests");
      setRequests(data.requests);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pickup requests");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
```

- [ ] **Step 2: Add the attribute handler**

Add alongside `handleMarkPacked`:

```tsx
  const handleAttribute = async (id: string) => {
    setAttributingId(id);
    try {
      const res = await fetch(`/api/admin/collection-requests/${id}/attribute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to attribute handover");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attribute handover");
    } finally {
      setAttributingId(null);
    }
  };
```

- [ ] **Step 3: Add the tab bar and completed-row content**

Replace the `<Typography variant="h5" ...>` header block with:

```tsx
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
        In-Person Pickup Requests
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab value="open" label="Open" />
        <Tab value="completed" label="Completed" />
      </Tabs>
```

Inside the `requests.map((request) => { ... })` block, after the existing `<Divider sx={{ my: 1.5 }} />` and card-chip list, add (before the closing `</CardContent>`):

```tsx
                {request.status === "COLLECTED" && (
                  <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: 13, color: "#6b7280" }}>
                      Collected {new Date(request.collectedAt as string).toLocaleDateString()}
                    </Typography>
                    {request.collectedByStaff ? (
                      <Chip size="small" label={`Handled by ${request.collectedByStaff.username ?? "staff"}`} />
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={attributingId === request.id}
                        onClick={() => handleAttribute(request.id)}
                        sx={{ textTransform: "none" }}
                      >
                        {attributingId === request.id ? "Saving…" : "Attribute to me"}
                      </Button>
                    )}
                  </Box>
                )}
```

- [ ] **Step 4: Manually verify in the browser**

Run: `pnpm dev:next`, log in as an admin, visit `/admin/collection-requests`. Confirm the Open tab still works as before, the Completed tab loads (empty state or real completed requests), and clicking "Attribute to me" on a completed row updates it to show "Handled by <you>".

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/collection-requests/AdminCollectionRequests.tsx
git commit -m "Add Completed tab with staff handover attribution to admin pickup page"
```

---

## Self-Review Notes

- **Spec coverage:** schema field (Task 1), admin query split (Task 2), attribution endpoint (Task 3), UI tabs + button (Task 4) — all four spec sections covered. Customer OTP flow untouched, per spec's non-goal.
- **Type consistency:** `collectedByStaff: { id: string; username: string | null } | null` is the same shape across Task 2's route, Task 3's route, and Task 4's interface.
- **No placeholders:** every step has real, complete code.
