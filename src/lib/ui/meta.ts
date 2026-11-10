import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

const OG = "/brand/og-default.png";

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  follow?: boolean;
  image?: string;
}): Metadata {
  const image = opts.image || OG;
  const url = canonical(opts.path);
  const staging = process.env.SITE_NOINDEX === "true";
  const index = !staging && opts.index !== false;
  const follow = staging ? false : opts.follow !== false;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: { index, follow },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      siteName: "Tharkoo",
      images: [image],
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}
