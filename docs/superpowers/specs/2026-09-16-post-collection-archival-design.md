# Post-Collection Handling — Design

**Date:** 2026-09-16
**Status:** Approved, pending implementation plan

## Problem

Once a customer confirms in-person pickup, `CollectionRequest.status` becomes `COLLECTED` and every attached `Listing` gets `collectedAt` stamped. Nothing else happens. The admin page (`GET /api/admin/collection-requests`) only ever queries `REQUESTED`/`PACKED` — a collected request simply disappears from staff view, with no way to look it up again, and no record of which staff member handled the handover.

## Goals

- Give staff a way to see completed pickups, without touching the active-requests view.
- Record which staff member handled a given handover, for internal record-keeping.
- Do this without deleting or relocating any existing row — `Listing` and `CollectionRequest` already never get deleted (`collectedAt`/`status` flags only), and this design keeps that pattern.

## Non-goals

- Moving collected data to a separate archive table. Confirmed with the user: same tables, an added view is sufficient. Nothing here suggests today's data volume needs physical separation, and it can be revisited later if it does.
- Changing the customer-facing pickup flow (`POST /api/collection-requests/[id]/otp/confirm`). It stays exactly as-is — self-service, customer's own session only.
- A `packedByStaffId` field. Only the collection/handover attestation was asked for; packing already has `packedAt` with no staff attribution today, and adding one wasn't requested. Easy to add later, symmetrically, if wanted.

## Design

### Schema change

One nullable field on `CollectionRequest`:

```prisma
model CollectionRequest {
  // ...existing fields...

  // Staff attestation: which admin confirmed they physically handed the
  // cards over. Set by a separate, optional admin action — never by the
  // customer's own OTP confirm, which has no staff session in it at all
  // (POST /api/collection-requests/[id]/otp/confirm requires the caller's
  // session to *be* the customer). Null until a staff member attributes
  // the handover to themselves; never required to reach COLLECTED.
  collectedByStaff   User?   @relation("CollectionHandovers", fields: [collectedByStaffId], references: [id], onDelete: SetNull)
  collectedByStaffId String?
}
```

Added to `User` as the inverse relation (`collectionHandovers CollectionRequest[] @relation("CollectionHandovers")`), matching the existing relation-naming convention already used for `User.reservedListings`/`CardReservations`.

### Why a separate action, not a field bolted onto the existing confirm

Traced the actual route: `otp/confirm` requires `session.user.id === request.userId` — it can only ever be called by the customer, authenticated as themselves. There is no staff session inside that transaction to attribute anything to. Recording "which staff member" therefore needs its own explicit action, not a parameter threaded through the customer's confirmation.

### New endpoint

`POST /api/admin/collection-requests/[id]/attribute` — admin-only (same `session.user.role !== "admin"` guard as the existing admin route). Sets `collectedByStaffId = session.user.id` on a `COLLECTED` request. Idempotent: calling it again just re-attributes to whoever calls it (last write wins) — no need for a lock or a "can't reassign" rule, since this is an internal note, not a security boundary.

### Admin UI

Two tabs on the existing `/admin/collection-requests` page (`AdminCollectionRequests.tsx`), reusing its existing card-list layout:

- **Open** (current behavior, unchanged): `REQUESTED`/`PACKED`, with the existing "Mark as Packed" action.
- **Completed** (new): `status: "COLLECTED"`, ordered by `collectedAt` descending. Each row shows the same card summary already shown today, plus:
  - Collected date.
  - Either "Handled by {staff username}" (if `collectedByStaffId` is set) or an "Attribute to me" button (if not) — a single click, no confirmation dialog, since it's a low-stakes internal note.

`GET /api/admin/collection-requests` gains a `?status=open|completed` query param (default `open`, preserving today's behavior for any existing caller) instead of splitting into two endpoints — same query shape, one extra `where` branch.

This is a small enough UI addition that it doesn't need a separate visual design pass — it's two tabs and one button, following patterns already on the same page.

## Testing

- `GET /api/admin/collection-requests?status=completed` — returns only `COLLECTED` requests, ordered correctly, includes `collectedByStaff`.
- `POST /api/admin/collection-requests/[id]/attribute` — sets the field; rejects non-admins (403); rejects a request that isn't `COLLECTED` yet (400, since attributing a handover that hasn't happened makes no sense).
- Existing `AdminCollectionRequests` tests (if any) still pass with the default `status=open` tab.

## Out of scope for this design (candidate follow-ups, not required now)

- `packedByStaffId`, symmetric to `collectedByStaffId`.
- Any governance/export tooling (CSV export, retention policy) beyond the admin view — nothing suggested today's volume needs it.
