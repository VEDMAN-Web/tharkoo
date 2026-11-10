import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function siteNoindex() {
  return process.env["SITE_NOINDEX"] === "true";
}

export default function robots(): MetadataRoute.Robots {
  if (siteNoindex()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/", "/*?*page="] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
