import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health
//
// Cheap uptime-monitoring endpoint. Deliberately unauthenticated — it's
// meant to be hit by an external monitor (Vercel/UptimeRobot/etc.), not a
// signed-in user. Runs the cheapest possible query against the database so
// the response actually reflects whether the app can talk to Postgres, not
// just whether the Next.js process is alive.
//
// Never leaks the underlying error (connection string, stack trace, etc.)
// into the response body — only a generic ok/error status is returned.
// The real error is logged server-side only.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[health] Database check failed:", err);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
