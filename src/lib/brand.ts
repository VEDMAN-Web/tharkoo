export const LOGO_LIGHT_DEFAULT = "/brand/logo-horizontal.png";
export const LOGO_DARK_DEFAULT = "/brand/logo-horizontal-white.png";

/** The shape of the supplied logo files (1224 x 386). Used to give the image its width before it loads. */
export const LOGO_RATIO = 1224 / 386;

/** An address a logo may have: a path on this site or an https image. Anything else falls back to the default. */
export function brandLogoUrl(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 600 || /\s/.test(text)) return fallback;
  if (text.startsWith("/") && !text.startsWith("//") && !text.includes("\\")) return text;
  return /^https:\/\/[^\s"'<>]+$/.test(text) ? text : fallback;
}

export type SiteLogos = { light: string; dark: string };

export function siteLogos(site: { logoUrl?: unknown; logoDarkUrl?: unknown }): SiteLogos {
  return { light: brandLogoUrl(site.logoUrl, LOGO_LIGHT_DEFAULT), dark: brandLogoUrl(site.logoDarkUrl, LOGO_DARK_DEFAULT) };
}
