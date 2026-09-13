// src/lib/seedImages.ts
//
// Downloads an external image and re-hosts it in the card-images Supabase
// bucket. next.config.mjs's remotePatterns only allowlists the Supabase
// storage host for next/image, so any Listing.imageUrls entry pointing at
// an external host (e.g. riftcodex's CMS) breaks /cards/[id] outright —
// every image a seed script attaches to a Listing must go through here
// first, never used as-is.
//
// Downloads are cached to a local file on disk so re-running a seed script
// (e.g. after a partial failure, or after resetting the DB/storage) never
// re-fetches an image the machine already has.

import fs from "fs";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { compressCardImage, toWebpStoragePath } from "@/lib/imageProcessing";

export interface DownloadedImage {
  buffer: Buffer;
  contentType: string;
}

function contentTypeFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

export async function downloadImageWithCache(
  sourceUrl: string,
  cacheFilePath: string
): Promise<DownloadedImage> {
  if (fs.existsSync(cacheFilePath)) {
    return {
      buffer: fs.readFileSync(cacheFilePath),
      contentType: contentTypeFromExtension(cacheFilePath),
    };
  }

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to download ${sourceUrl}: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";

  fs.mkdirSync(path.dirname(cacheFilePath), { recursive: true });
  fs.writeFileSync(cacheFilePath, buffer);

  return { buffer, contentType };
}

// Free-tier Supabase projects have real storage/bandwidth caps, and reseed
// scripts can re-run the exact same upload hundreds of times (e.g. after
// prisma/seed.ts wipes the Listing table, seedRiftboundListings.ts sees
// every catalog card as "not yet listed" again even though the image is
// already sitting in the bucket, unchanged). Check first and skip the
// upload entirely when the object is already there.
async function objectExists(
  supabase: SupabaseClient,
  bucket: string,
  storagePath: string
): Promise<boolean> {
  const folder = path.dirname(storagePath);
  const filename = path.basename(storagePath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(folder === "." ? undefined : folder, { search: filename, limit: 1 });
  // Fail open — if the existence check itself errors, fall through to a
  // normal upload rather than silently skipping a genuinely-missing image.
  if (error) return false;
  return !!data?.some((f) => f.name === filename);
}

export async function uploadImage(
  supabase: SupabaseClient,
  image: DownloadedImage,
  storagePath: string
): Promise<string> {
  const webpPath = toWebpStoragePath(storagePath);
  const bucket = "card-images";

  if (await objectExists(supabase, bucket, webpPath)) {
    const { data: existingUrl } = supabase.storage.from(bucket).getPublicUrl(webpPath);
    return existingUrl.publicUrl;
  }

  const compressed = await compressCardImage(image.buffer);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(webpPath, compressed.buffer, { contentType: compressed.contentType, upsert: true });
  if (error) {
    throw new Error(`Failed to upload ${webpPath} to Supabase: ${error.message}`);
  }

  // A previous, pre-compression run may have uploaded the original under its
  // source extension (e.g. .png) — clean it up so the bucket doesn't carry
  // both copies. Best-effort: the object may simply not exist.
  if (webpPath !== storagePath) {
    await supabase.storage.from(bucket).remove([storagePath]);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);
  return publicUrlData.publicUrl;
}

// Both prisma/seed.ts and prisma/seedRiftboundListings.ts cache Riftbound
// images to disk — this is the one place that decides where, so they can
// never accidentally disagree and each maintain their own separate cache.
export function riftboundImageCachePath(riftboundId: string): string {
  return path.join(process.cwd(), "prisma", ".cache", "riftbound-images", `${riftboundId}.png`);
}

export async function uploadImageFromUrl(
  supabase: SupabaseClient,
  sourceUrl: string,
  storagePath: string,
  cacheFilePath: string
): Promise<string> {
  const image = await downloadImageWithCache(sourceUrl, cacheFilePath);
  return uploadImage(supabase, image, storagePath);
}
