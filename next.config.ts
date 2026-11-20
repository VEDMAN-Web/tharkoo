import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // H17.11: Google Analytics (loaded only after a visitor chooses Accept).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
      "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
    ].join("; "),
  },
];

// VS Code port forwarding (dev tunnels) puts a *.devtunnels.ms host in front of localhost, while the browser still sends
// Origin: localhost:4317. Next compares that Origin with the forwarded host and, if they differ, only accepts it when the
// Origin is in allowedOrigins. So the local origins are listed here, in development only. Production keeps the strict check.
const isProd = process.env.NODE_ENV === "production";
const devTunnelHosts = isProd ? [] : ["*.devtunnels.ms", "**.devtunnels.ms"];
const devActionOrigins = isProd ? [] : ["localhost:4317", "127.0.0.1:4317", ...devTunnelHosts];

const nextConfig: NextConfig = {
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1", ...devTunnelHosts],
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
    serverActions: { allowedOrigins: devActionOrigins },
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
