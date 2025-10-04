/**
 * This file sets up and exports a single shared Prisma Client instance.
 *
 * ✅ What it does:
 * - Ensures we don’t create multiple Prisma Client instances during hot reloads (Next.js dev mode).
 * - Configures Prisma logging for debugging queries, errors, and warnings.
 * - Exports a `prisma` object you can use anywhere to query your Postgres DB.
 *
 * ✅ Why it’s needed:
 * - Without this, each time Next.js reloads, a new PrismaClient instance is created.
 *   That can exhaust database connections and crash your app.
 * - By attaching Prisma to the `global` object, we reuse the same instance in development.
 *
 * ✅ How it works:
 * - `globalForPrisma` acts like a cache for Prisma on the global object.
 * - If no Prisma client exists yet, create one.
 * - If we’re in development, store it globally so hot reloads reuse it.
 * - In production, always create a new instance (to avoid cross-request leakage).
 *
 * 👉 TL;DR: This file is your "database connector."
 * You import `{ prisma }` anywhere you need to talk to the DB.
 */

// Import the generated Prisma client (from your `prisma/schema.prisma` models)
import { PrismaClient } from "@prisma/client";

// Attach Prisma client to global object to avoid re-instantiating on hot reloads
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Either reuse the existing Prisma client (if already created) OR make a new one
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"], // log SQL queries, errors, and warnings in console
  });

// In development, reuse the same Prisma client across hot reloads
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
