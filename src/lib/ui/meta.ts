import type { Metadata } from "next";
import { canonical } from "@/lib/seo";

const OG = "/brand/og-default.png";

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  image?: string;
}): Metadata {
  const image = opts.image || OG;
  const url = canonical(opts.path);
  const index = opts.index !== false;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
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
