import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/utils";
import { getSeoSettings } from "@/app/admin/seo/settings/store";

export const dynamic = "force-dynamic";

/** Always blocked, for every crawler. */
export const PRIVATE_DISALLOW = ["/u/", "/search", "/admin/", "/api/"];

function siteNoindex() {
  return process.env["SITE_NOINDEX"] === "true";
}

async function extraDisallow() {
  try {
    return (await getSeoSettings()).robotsDisallow;
  } catch {
    return [];
  }
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const sitemap = `${siteUrl()}/sitemap.xml`;
  if (siteNoindex()) {
    return { rules: [{ userAgent: "*", disallow: "/" }], sitemap };
  }
  const extra = (await extraDisallow()).filter((line) => !PRIVATE_DISALLOW.includes(line));
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...PRIVATE_DISALLOW, ...extra] }],
    sitemap,
  };
}
