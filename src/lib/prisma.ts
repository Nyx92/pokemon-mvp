/**
 * Singleton Prisma Client.
 *
 * ── Problem ──────────────────────────────────────────────────────────────────
 * Next.js hot reloads re-evaluate modules on every file save. Without a
 * singleton, each re-evaluation calls `new PrismaClient()` which opens a
 * fresh TCP connection pool to the database. On the Supabase session-mode
 * pooler (port 5432) connections are held for the lifetime of the client, so
 * stale pools from previous hot-reload cycles accumulate until you exceed the
 * hard limit of 15 session-mode connections and get EMAXCONNSESSION errors.
 *
 * ── Solution ─────────────────────────────────────────────────────────────────
 * We cache the PrismaClient on the Node.js `global` object. `global` is NOT
 * re-evaluated on hot reloads — it persists for the lifetime of the Node.js
 * process — so every subsequent import gets the same instance and the same
 * underlying connection pool.
 *
 * The assignment is unconditional (not guarded by NODE_ENV). Older patterns
 * only cached in development and created a fresh client in production, which
 * could still cause accumulation inside a long-running `next start` process.
 *
 * ── Connection pool ──────────────────────────────────────────────────────────
 * DATABASE_URL points to Supabase's transaction-mode pooler (port 6543).
 * In transaction mode a connection is borrowed for the duration of a single
 * query then immediately returned, so the pool is shared efficiently across
 * all concurrent API routes. connection_limit=5 in the URL caps Prisma's pool
 * size well below the 15-connection ceiling, leaving headroom for other
 * clients (e.g. migrations, Prisma Studio).
 */

import { PrismaClient } from "@prisma/client";

// Extend the global type so TypeScript knows about our cached client.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// ??= only runs the right-hand side when globalForPrisma.prisma is null/undefined,
// i.e. the very first time this module is evaluated in the current process.
// Every subsequent hot reload or import skips the constructor entirely.
globalForPrisma.prisma ??= new PrismaClient({
  // Full query logging in development helps trace N+1 queries and slow calls.
  // Production logs errors only — query logging at scale generates too much noise.
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

export const prisma = globalForPrisma.prisma;
