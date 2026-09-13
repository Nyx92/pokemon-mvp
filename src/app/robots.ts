import type { MetadataRoute } from "next";

// Fallback only used when NEXT_PUBLIC_SITE_URL is unset (e.g. local dev).
// Never hardcode this as the only source of truth — production sets the
// real env var at deploy time (see pre-launch hardening plan).
const FALLBACK_BASE_URL = "http://localhost:3001";

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_BASE_URL;
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/marketplace", "/cards/*"],
      disallow: [
        "/cart",
        "/checkout",
        "/profile",
        "/myCollection",
        "/offers",
        "/notifications",
        "/watchlist",
        "/purchases",
        "/sold",
        "/upload",
        "/api/*",
        "/auth/*",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
