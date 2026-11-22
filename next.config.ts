import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // H18.10: the live video call runs inside a Daily frame, so only that frame may ask for camera and microphone.
  { key: "Permissions-Policy", value: 'camera=(self "https://*.daily.co"), microphone=(self "https://*.daily.co"), geolocation=(), display-capture=(self "https://*.daily.co")' },
  // H18.10 (security review F2, F3): always HTTPS; never shown inside another site's frame.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    // H18.10 (security review F1): enforced now, and no 'unsafe-eval'.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // H17.11: Google Analytics (loaded only after a visitor chooses Accept).
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
      "connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
      "media-src 'self' blob: https:",
      "frame-src 'self' https://*.daily.co",
      "worker-src 'self' blob:",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
  trailingSlash: true,
  poweredByHeader: false,
  // Send metadata in <head> for every user agent (Next streams it into <body> for JS-capable
  // bots and browsers by default). Canonical/robots must be in the first HTML for SEO.
  htmlLimitedBots: /.*/,
  output: "standalone",
  // H16.1: the Import cities and areas screen reads the built-in lists in data/locations/, so the standalone build must carry them.
  outputFileTracingIncludes: { "/admin/locations": ["./data/locations/*.csv"] },
  cacheMaxMemorySize: 16 * 1024 * 1024,
  experimental: {
    imgOptConcurrency: 1,
  },
  images: {
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24,
    deviceSizes: [390, 768, 1200],
    imageSizes: [64, 96, 160, 256],
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async redirects() {
    return [
      { source: "/login", destination: "/u/login/", permanent: true },
      { source: "/signup", destination: "/u/register/", permanent: true },
      { source: "/register", destination: "/u/register/", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/sitemap/:shard.xml", destination: "/sitemap/:shard/" }],
      afterFiles: [{ source: "/:key.txt", destination: "/api/indexnow/:key" }],
    };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/u/account/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
