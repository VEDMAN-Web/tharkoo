import type { ShellConfig, ShellImage } from "@/server/site-links/shell-config-rules";

/** A band photo: the computer image and the phone image (phone falls back to the computer image). */
export type BandPhoto = { band: string; bandPhone: string; focus?: string; phoneFocus?: string };

/** The places a page can take its band from, most specific first. Only the levels a page allows are passed. */
export type BandLevels = { city?: string; state?: string; category?: string };

/** The home hero photo, the default band. Read from the saved homepage content; null when none is set. */
export function heroBandFrom(
  content: { hero?: { photo?: string; photoPhone?: string; focusX?: number; focusY?: number; phoneFocusX?: number; phoneFocusY?: number } } | null | undefined,
): BandPhoto | null {
  const hero = content?.hero;
  const photo = hero?.photo?.trim() || "";
  if (!photo) return null;
  const phone = hero?.photoPhone?.trim() || "";
  return {
    band: photo,
    bandPhone: phone || photo,
    ...(focusText(hero?.focusX, hero?.focusY, DEFAULT_BAND_FOCUS_X, DEFAULT_BAND_FOCUS_Y) ? { focus: focusText(hero?.focusX, hero?.focusY, DEFAULT_BAND_FOCUS_X, DEFAULT_BAND_FOCUS_Y) } : {}),
    ...(phone && focusText(hero?.phoneFocusX, hero?.phoneFocusY, DEFAULT_PHONE_FOCUS_X, DEFAULT_PHONE_FOCUS_Y)
      ? { phoneFocus: focusText(hero?.phoneFocusX, hero?.phoneFocusY, DEFAULT_PHONE_FOCUS_X, DEFAULT_PHONE_FOCUS_Y) }
      : {}),
  };
}

const DEFAULT_BAND_FOCUS_X = 72;
const DEFAULT_BAND_FOCUS_Y = 18;
const DEFAULT_PHONE_FOCUS_X = 50;
const DEFAULT_PHONE_FOCUS_Y = 12;

function focusText(x: number | undefined, y: number | undefined, defaultX: number, defaultY: number): string | undefined {
  if (x === undefined && y === undefined) return undefined;
  return `${x ?? defaultX}% ${y ?? defaultY}%`;
}

export function sameSlug(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a) && Boolean(b) && a!.trim().toLowerCase() === b!.trim().toLowerCase();
}

function imageFor(shell: ShellConfig, scope: ShellImage["scope"], slug: string | undefined): BandPhoto | null {
  if (!slug) return null;
  const image = shell.media.images.find((item) => item.scope === scope && sameSlug(item.slug, slug));
  if (!image || !(image.band || image.bandPhone)) return null;
  const focus = focusText(image.bandFocusX, image.bandFocusY, DEFAULT_BAND_FOCUS_X, DEFAULT_BAND_FOCUS_Y);
  const phoneFocus = focusText(image.bandPhoneFocusX, image.bandPhoneFocusY, DEFAULT_PHONE_FOCUS_X, DEFAULT_PHONE_FOCUS_Y);
  return {
    band: image.band || image.bandPhone,
    bandPhone: image.bandPhone || image.band,
    ...(focus ? { focus } : {}),
    ...(phoneFocus ? { phoneFocus } : {}),
  };
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
  const category = images.find((image) => image.scope === "category" && sameSlug(image.slug, categorySlug));
  return category && (category.band || category.bandPhone) ? category : null;
}

/** H7.32: the image the admin set for a city, or null. */
export function cityBandImageFor(shell: ShellConfig, citySlug: string): ShellImage | null {
  const city = shell.media.images.find((image) => image.scope === "city" && sameSlug(image.slug, citySlug));
  return city && (city.band || city.bandPhone) ? city : null;
}

const DEFAULT_BAND_FOCUS = `${DEFAULT_BAND_FOCUS_X}% ${DEFAULT_BAND_FOCUS_Y}%`;

/**
 * The CSS variables for the band: the computer image, the phone image and their focus points. The URLs were checked
 * when they were saved. With no photo the band keeps its gradient (see listing-spec.css).
 */
export function bandStyleFor(image: Partial<BandPhoto> | null): Record<string, string> {
  const style: Record<string, string> = {};
  if (image?.band) style["--band-desk"] = `url("${image.band}")`;
  const phone = image?.bandPhone || image?.band;
  if (phone) style["--band-phone"] = `url("${phone}")`;
  if (image?.focus) style["--band-focus"] = image.focus;
  const samePhoto = Boolean(image?.band) && (!image?.bandPhone || image.bandPhone === image.band);
  if (samePhoto) style["--band-focus-phone"] = image?.focus || DEFAULT_BAND_FOCUS;
  else if (image?.phoneFocus) style["--band-focus-phone"] = image.phoneFocus;
  return style;
}
