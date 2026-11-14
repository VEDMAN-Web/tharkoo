import type { ShellConfig, ShellImage } from "@/server/site-links/shell-config-rules";

/**
 * H7.4: the image for a category and city listing title band. The city's image wins when the admin set one for
 * that city; otherwise the category's. Pure, so the server page and the tests share it.
 */
export function bandImageFor(shell: ShellConfig, categorySlug: string, citySlug: string): ShellImage | null {
  const images = shell.media.images;
  const city = images.find((image) => image.scope === "city" && image.slug === citySlug);
  if (city && (city.band || city.bandPhone)) return city;
  const category = images.find((image) => image.scope === "category" && image.slug === categorySlug);
  return category && (category.band || category.bandPhone) ? category : null;
}
