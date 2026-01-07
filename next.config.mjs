// This file: is read only by Next.js during build + dev startup
// controls framework features like images, routing, webpack, experimental flags

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ===== IMAGE OPTIMIZATION SETTINGS =====
  images: {
    // remotePatterns is a SECURITY allow-list.
    // next/image will only load external images whose URL matches
    // one of these patterns.
    remotePatterns: [
      {
        // protocol that must match the image URL
        protocol: "https",

        // the exact domain / host name where your images are stored.
        // this is your Supabase project CDN host
        hostname: "tfjkxfalbqegwjsfbyuo.supabase.co",

        // which URL paths under that host are allowed.
        // you can restrict to specific buckets if you want
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // You could later add:
  // - redirects
  // - env exposure
  // - bundle analyzer
  // - experimental server actions
};
// Export default is required because you use ESM (.mjs) syntax
export default nextConfig;
