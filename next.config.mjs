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

  // ===== SECURITY HEADERS =====
  // Applied to every route. Kept intentionally permissive in a few spots
  // (script/style 'unsafe-inline', script 'unsafe-eval') because this app
  // relies on:
  //   - MUI/emotion, which injects <style> tags at runtime (breaks under a
  //     strict style-src without 'unsafe-inline')
  //   - Next.js dev-mode HMR / React Fast Refresh, which uses eval
  //   - Next.js's own inline hydration <script> (__NEXT_DATA__)
  // An overly strict CSP that silently breaks Stripe Elements, next/image,
  // or the app's own styling would be worse than no CSP — see the plan doc
  // this was implemented from (docs/superpowers/plans/2026-09-13-pre-launch-hardening.md).
  async headers() {
    const csp = [
      "default-src 'self'",
      // Stripe.js loads its own script + posts to api.stripe.com.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      // Supabase Storage is the only external image host (matches
      // images.remotePatterns above); data:/blob: cover next/image
      // placeholders and any client-side blob previews.
      "img-src 'self' data: blob: https://tfjkxfalbqegwjsfbyuo.supabase.co",
      // next/font/google self-hosts fonts at build time — no external
      // font-src needed (see src/app/layout.tsx).
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com",
      // Stripe Elements/Checkout render inside iframes from these hosts.
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  // You could later add:
  // - redirects
  // - env exposure
  // - bundle analyzer
  // - experimental server actions
};
// Export default is required because you use ESM (.mjs) syntax
export default nextConfig;
