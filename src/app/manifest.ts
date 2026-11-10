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
      { src: "/brand/logo-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
