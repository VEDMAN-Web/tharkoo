import { permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { legacyAdRedirect } from "@/server/listings/ad-route";
import { AdView, adViewMetadata } from "./AdView";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return adViewMetadata((await params).slug);
}

/** H16.2: the old /ad/<slug>/ address only forwards. The ad itself lives at /<category>/<city>/<title>-<code>/. */
export default async function LegacyAdPage({ params }: Props) {
  const { slug } = await params;
  const to = await legacyAdRedirect(slug);
  if (to) permanentRedirect(to);
  return AdView({ slug });
}
