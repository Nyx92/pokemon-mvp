import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { listingCatalogInclude, withListingDisplay } from "@/lib/listingDisplay";
import { centsToDollars } from "@/lib/money";
import CardDetailClient from "./CardDetailClient";

// Falls back to localhost only when NEXT_PUBLIC_SITE_URL isn't set (local
// dev) — production deploys must set the real domain so OG/canonical URLs
// aren't emitted as localhost.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Server-side only — deliberately independent of the client page's own
// `/api/cards/[id]` fetch. This runs once per request for metadata/JSON-LD
// and must never gate or replace the client component's own data fetching,
// error states (not_found/error), or auth-aware fields.
async function getListingForMetadata(id: string) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: listingCatalogInclude,
  });
  if (!listing) return null;
  return withListingDisplay(listing);
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const listing = await getListingForMetadata(params.id);

  if (!listing) {
    return {
      title: "Card not found | Pokémon MVP",
      robots: { index: false, follow: false },
    };
  }

  const price = listing.price != null ? centsToDollars(listing.price) : null;
  const priceText = price != null ? `S$${price.toFixed(2)}` : "Not currently for sale";
  const description = `${listing.title} — ${listing.condition} condition. ${priceText}.${
    listing.setName ? ` Set: ${listing.setName}.` : ""
  }`.trim();
  const image = listing.imageUrls?.[0];
  const url = `${SITE_URL}/cards/${params.id}`;

  return {
    title: `${listing.title} | Pokémon MVP`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: listing.title,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function CardDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const listing = await getListingForMetadata(params.id);

  const jsonLd = listing
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: listing.title,
        image: listing.imageUrls ?? [],
        description: listing.description || undefined,
        sku: params.id,
        offers: {
          "@type": "Offer",
          priceCurrency: "SGD",
          price:
            listing.price != null ? centsToDollars(listing.price).toFixed(2) : "0",
          availability: listing.forSale
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          url: `${SITE_URL}/cards/${params.id}`,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          // JSON.stringify of server-fetched, non-HTML data — not raw user input.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <CardDetailClient />
    </>
  );
}
