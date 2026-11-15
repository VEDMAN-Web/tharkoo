import type { ShellConfig, ShellImage } from "@/server/site-links/shell-config-rules";

/**
 * H7.4: the image for a category and city listing title band. The city's image wins when the admin set one for
 * that city; otherwise the category's. Pure, so the server page and the tests share it. A category page has no city,
 * so pass no city slug there.
 */
export function bandImageFor(shell: ShellConfig, categorySlug: string, citySlug?: string): ShellImage | null {
  const images = shell.media.images;
  const city = citySlug ? images.find((image) => image.scope === "city" && image.slug === citySlug) : undefined;
  if (city && (city.band || city.bandPhone)) return city;
  const category = images.find((image) => image.scope === "category" && image.slug === categorySlug);
  return category && (category.band || category.bandPhone) ? category : null;
}

/**
 * The CSS variables for the band: the computer image and the phone image. The URLs were checked when they were saved.
 * With no image the band keeps its gradient (see listing-spec.css).
 */
export function bandStyleFor(image: ShellImage | null): Record<string, string> {
  const style: Record<string, string> = {};
  if (image?.band) style["--band-desk"] = `url("${image.band}")`;
  const phone = image?.bandPhone || image?.band;
  if (phone) style["--band-phone"] = `url("${phone}")`;
  return style;
}
