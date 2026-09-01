// src/lib/imageProcessing.ts
//
// Every card image is displayed at a maximum of ~360px logical width (the
// card detail view) or 130px (marketplace/list tiles) — never anywhere near
// the multi-megapixel originals sellers upload or seed scripts download.
// Re-encoding to WebP and capping the width here, once, at the upload
// boundary keeps Supabase Storage usage and page-load bytes proportional to
// what actually gets shown instead of to the source file size.

import sharp from "sharp";

const MAX_WIDTH = 800;
const WEBP_QUALITY = 82;

export interface CompressedImage {
  buffer: Buffer;
  contentType: string;
}

export async function compressCardImage(input: Buffer): Promise<CompressedImage> {
  const buffer = await sharp(input)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return { buffer, contentType: "image/webp" };
}

// Storage paths are built with the source file's original extension
// (.png/.jpg/...); since compression always re-encodes to WebP, the stored
// key must end in .webp too, or the contentType and extension mismatch.
export function toWebpStoragePath(storagePath: string): string {
  return storagePath.replace(/\.[^./]+$/, ".webp");
}
