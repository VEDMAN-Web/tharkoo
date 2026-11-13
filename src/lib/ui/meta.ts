import type { Metadata } from "next";
import { canonical } from "@/lib/seo";
import { publicPath } from "@/lib/seo/schema";

export const DEFAULT_OG_PATH = "/brand/og-default.png";
const OG = DEFAULT_OG_PATH;

function absolute(image: string) {
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return canonical(image.startsWith("/") ? image : `/${image}`);
}

export type PageMeta = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  follow?: boolean;
  image?: string;
  canonicalUrl?: string;
};

export function pageMetadata(opts: PageMeta): Metadata {
  const image = absolute(opts.image || OG);
  const url = opts.canonicalUrl || canonical(publicPath(opts.path));
  const staging = process.env.SITE_NOINDEX === "true";
  const index = !staging && opts.index !== false;
  const follow = staging ? false : opts.follow !== false;
  return {
    title: opts.title,
    description: opts.description,
    alternates: {
      canonical: url,
      languages: { "en-IN": url, "x-default": url },
    },
    robots: { index, follow },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "Tharkoo",
      images: [{ url: image, width: 1200, height: 630, alt: opts.title }],
      locale: "en_IN",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}
