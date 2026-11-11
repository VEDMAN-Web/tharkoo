import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

function siteNoindex() {
  return process.env["SITE_NOINDEX"] === "true";
}

export default function robots(): MetadataRoute.Robots {
  const sitemap = `${siteUrl()}/sitemap.xml`;
  if (siteNoindex()) {
    return { rules: [{ userAgent: "*", disallow: "/" }], sitemap };
  }
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/u/", "/search", "/admin/", "/api/"] },
    ],
    sitemap,
  };
}
