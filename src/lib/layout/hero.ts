/*
 * Hero block settings (H6.9, default changed in H6.13). Pure and client-safe: the block schema, the public hero and the editor preview all read these.
 * H6.13: the full banner is the default. A block with `heroVersion` (2 or later) and no `layout` is a full banner.
 * A block saved before H6.13 (no `heroVersion`) with no look setting of its own is the old default: shown as a full banner.
 * An old block with its own look settings keeps the split hero it had. The daily migration (src/server/layout/hero-migration.ts) writes the layout into the data.
 */

export const HERO_LAYOUTS = ["split", "full"] as const;
export const HERO_FITS = ["cover", "contain"] as const;
export const HERO_FOCUS = ["left", "center", "right", "top", "bottom"] as const;
export const HERO_HEIGHTS = ["auto", "small", "medium", "large", "full"] as const;
export const HERO_ALIGNS = ["left", "center", "right"] as const;
export const HERO_VERTICALS = ["top", "middle", "bottom"] as const;
export const HERO_TONES = ["light", "dark"] as const;

export type HeroLayout = (typeof HERO_LAYOUTS)[number];
export type HeroFit = (typeof HERO_FITS)[number];
export type HeroFocus = (typeof HERO_FOCUS)[number];
export type HeroHeight = (typeof HERO_HEIGHTS)[number];
export type HeroAlign = (typeof HERO_ALIGNS)[number];
export type HeroVertical = (typeof HERO_VERTICALS)[number];
export type HeroTone = (typeof HERO_TONES)[number];
export type HeroOverlay = "gradient" | "color" | "none";

/** The colour of the old gradient on the split hero. Also the default colour of the dark layer. */
export const HERO_OVERLAY_COLOR = "#2a2316";
export const HERO_OVERLAY_OPACITY = 40;
export const HERO_OVERLAY_MAX_OPACITY = 80;

/** Version of the hero data. 2 = the full banner is the default (H6.13). Written by the editor and by the migration. */
export const HERO_VERSION = 2;

/** Settings a user can change in the editor. A block that sets one of these (and no layout) is not on the old default. */
export const HERO_LOOK_KEYS = [
  "fit",
  "focus",
  "height",
  "overlayOn",
  "overlayColor",
  "overlayOpacity",
  "showHeadline",
  "showSubtext",
  "showSearch",
  "textAlign",
  "textVertical",
  "textTone",
  "textShadow",
] as const;

/** Background behind an image shown with "contain" (the bars around it). */
export const HERO_CONTAIN_BACKGROUND = "#1d1a14";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

export interface HeroSettings {
  layout: HeroLayout;
  fit: HeroFit;
  focus: HeroFocus;
  height: HeroHeight;
  overlay: HeroOverlay;
  overlayColor: string;
  overlayOpacity: number;
  showHeadline: boolean;
  showSubtext: boolean;
  showSearch: boolean;
  textAlign: HeroAlign;
  textVertical: HeroVertical;
  textTone: HeroTone;
  textShadow: boolean;
}

/** Object position for each focal point. "top" is the position the split hero has always used. */
export const FOCUS_POSITION: Record<HeroFocus, string> = {
  left: "left center",
  center: "center center",
  right: "right center",
  top: "center top",
  bottom: "center bottom",
};

function choice<T extends string>(options: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Which overlay is in force.
 * - `overlayOn` set: true gives the colour layer, false gives none.
 * - not set, but a colour or opacity was saved: the colour layer.
 * - not set at all: the split hero keeps its gradient, the full banner has none.
 */
function overlayFor(props: Record<string, unknown>, layout: HeroLayout): HeroOverlay {
  if (props.overlayOn === false) return "none";
  if (props.overlayOn === true) return "color";
  if (props.overlayColor !== undefined || props.overlayOpacity !== undefined) return "color";
  return layout === "split" ? "gradient" : "none";
}

/** True when the saved block sets at least one look setting of its own. */
export function hasLookSettings(props: Record<string, unknown>): boolean {
  return HERO_LOOK_KEYS.some((key) => props[key] !== undefined);
}

/** The layout a block is shown with. A missing or unknown layout takes the default (see the file comment). */
export function layoutFor(props: Record<string, unknown>): HeroLayout {
  if (typeof props.layout === "string" && (HERO_LAYOUTS as readonly string[]).includes(props.layout)) return props.layout as HeroLayout;
  if (props.heroVersion !== undefined) return "full";
  return hasLookSettings(props) ? "split" : "full";
}

/** The hero as it is shown: every setting with its default filled in. Accepts any saved props, old or new. */
export function resolveHero(props: Record<string, unknown>): HeroSettings {
  const layout = layoutFor(props);
  const overlayColor =
    typeof props.overlayColor === "string" && HEX6.test(props.overlayColor) ? props.overlayColor.toLowerCase() : HERO_OVERLAY_COLOR;
  const rawOpacity = typeof props.overlayOpacity === "number" && Number.isFinite(props.overlayOpacity) ? Math.round(props.overlayOpacity) : HERO_OVERLAY_OPACITY;
  return {
    layout,
    fit: choice(HERO_FITS, props.fit, "cover"),
    focus: choice(HERO_FOCUS, props.focus, "top"),
    height: choice(HERO_HEIGHTS, props.height, "auto"),
    overlay: overlayFor(props, layout),
    overlayColor,
    overlayOpacity: Math.min(HERO_OVERLAY_MAX_OPACITY, Math.max(0, rawOpacity)),
    showHeadline: flag(props.showHeadline, true),
    showSubtext: flag(props.showSubtext, true),
    showSearch: flag(props.showSearch, true),
    textAlign: choice(HERO_ALIGNS, props.textAlign, "left"),
    textVertical: choice(HERO_VERTICALS, props.textVertical, "bottom"),
    textTone: choice(HERO_TONES, props.textTone, "light"),
    textShadow: flag(props.textShadow, false),
  };
}

/** Whether the dark layer shows (used by the editor's switch). */
export function heroOverlayOn(props: Record<string, unknown>): boolean {
  return resolveHero(props).overlay !== "none";
}

/** A hex colour at a percentage opacity, as an rgba() string for the overlay. */
export function overlayRgba(hex: string, percent: number): string {
  const value = Number.parseInt(HEX6.test(hex) ? hex.slice(1) : HERO_OVERLAY_COLOR.slice(1), 16);
  const alpha = Math.min(HERO_OVERLAY_MAX_OPACITY, Math.max(0, percent)) / 100;
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}
