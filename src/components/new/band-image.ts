import type { ShellConfig, ShellImage } from "@/server/site-links/shell-config-rules";

/** A band photo: the computer image and the phone image (phone falls back to the computer image). */
export type BandPhoto = { band: string; bandPhone: string };

/** The places a page can take its band from, most specific first. Only the levels a page allows are passed. */
export type BandLevels = { city?: string; state?: string; category?: string };

/** The home hero photo, the default band. Read from the saved homepage content; null when none is set. */
export function heroBandFrom(content: { hero?: { photo?: string; photoPhone?: string } } | null | undefined): BandPhoto | null {
  const photo = content?.hero?.photo?.trim() || "";
  if (!photo) return null;
  return { band: photo, bandPhone: content?.hero?.photoPhone?.trim() || photo };
}

function imageFor(shell: ShellConfig, scope: ShellImage["scope"], slug: string | undefined): BandPhoto | null {
  if (!slug) return null;
  const image = shell.media.images.find((item) => item.scope === scope && item.slug === slug);
  if (!image || !(image.band || image.bandPhone)) return null;
  return { band: image.band || image.bandPhone, bandPhone: image.bandPhone || image.band };
}

/**
 * H7.32: the band photo for a page. The first level that has a photo wins (city, then state, then category), and
 * the home hero photo is the default. Never empty when the hero has a photo. Pure, so pages and tests share it.
 */
export function bandChoice(shell: ShellConfig, hero: BandPhoto | null, levels: BandLevels): BandPhoto | null {
  return (
    imageFor(shell, "city", levels.city) ?? imageFor(shell, "state", levels.state) ?? imageFor(shell, "category", levels.category) ?? hero
  );
}

/**
 * H7.4: the image for a category and city listing title band. The city's image wins when the admin set one for
 * that city; otherwise the category's. Pure, so the server page and the tests share it. A category page has no city,
 * so pass no city slug there.
 */
export function bandImageFor(shell: ShellConfig, categorySlug: string, citySlug?: string): ShellImage | null {
  const images = shell.media.images;
  const city = citySlug ? cityBandImageFor(shell, citySlug) : null;
  if (city) return city;
  const category = images.find((image) => image.scope === "category" && image.slug === categorySlug);
  return category && (category.band || category.bandPhone) ? category : null;
}

/** H7.32: the image the admin set for a city, or null. */
export function cityBandImageFor(shell: ShellConfig, citySlug: string): ShellImage | null {
  const city = shell.media.images.find((image) => image.scope === "city" && image.slug === citySlug);
  return city && (city.band || city.bandPhone) ? city : null;
}

/**
 * The CSS variables for the band: the computer image and the phone image. The URLs were checked when they were saved.
 * With no photo the band keeps its gradient (see listing-spec.css).
 */
export function bandStyleFor(image: Partial<BandPhoto> | null): Record<string, string> {
  const style: Record<string, string> = {};
  if (image?.band) style["--band-desk"] = `url("${image.band}")`;
  const phone = image?.bandPhone || image?.band;
  if (phone) style["--band-phone"] = `url("${phone}")`;
  return style;
}
