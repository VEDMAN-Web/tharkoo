import type { Metadata } from "next";
import { canonical } from "@/lib/seo";
import { defaultOgImage } from "@/lib/seo-site";
import { DEFAULT_OG_PATH } from "@/lib/ui/meta";

/**
 * Swaps the built-in social image for the one chosen in /admin/seo/settings.
 * A page that set its own image (per-URL override or an ad photo) is left alone.
 */
export function applyDefaultOgImage(meta: Metadata, image: string): Metadata {
  const chosen = image.trim();
  if (!chosen) return meta;
  const url = /^https?:\/\//.test(chosen) ? chosen : canonical(chosen.startsWith("/") ? chosen : `/${chosen}`);
  const builtIn = canonical(DEFAULT_OG_PATH);
  const swap = <T extends { url: string | URL }>(images: T | T[] | undefined): T[] | undefined => {
    if (!images) return undefined;
    const list = Array.isArray(images) ? images : [images];
    return list.map((item) => (String(item.url) === builtIn ? { ...item, url } : item));
  };
  const og = meta.openGraph as (Record<string, unknown> & { images?: Parameters<typeof swap>[0] }) | null | undefined;
  const tw = meta.twitter as (Record<string, unknown> & { images?: unknown }) | null | undefined;
  const twImages = Array.isArray(tw?.images) ? (tw.images as (string | URL)[]).map((item) => (String(item) === builtIn ? url : item)) : tw?.images;
  return {
    ...meta,
    ...(og ? { openGraph: { ...og, images: swap(og.images) } as Metadata["openGraph"] } : {}),
    ...(tw ? { twitter: { ...tw, images: twImages } as Metadata["twitter"] } : {}),
  };
}

/** Metadata with the settings' default social image applied. Use it around a page's metadata. */
export async function withSeoDefaults(meta: Metadata): Promise<Metadata> {
  return applyDefaultOgImage(meta, await defaultOgImage());
}
