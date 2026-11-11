import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tharkoo",
    short_name: "Tharkoo",
    description: "Classified ads across Indian cities.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFDFB",
    theme_color: "#FFFDFB",
    lang: "en-IN",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
