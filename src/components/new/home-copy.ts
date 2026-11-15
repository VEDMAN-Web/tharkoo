import type { UiTextKey } from "@/lib/ui/text";

/** H7.4: small pure helpers for the New design home page. Kept apart from the components so they can be tested. */

const TIER_KEYS: Partial<Record<string, UiTextKey>> = {
  top: "card.tier.top",
  supertop: "card.tier.supertop",
  flash: "card.tier.supertop",
  star: "card.tier.star",
  highlight: "card.tier.highlight",
  new: "card.tier.new",
};

/** The gold badge text for an ad's variant. Free ads, and unknown variants, have no badge. */
export function tierKeyOf(variant?: string): UiTextKey | undefined {
  return variant ? TIER_KEYS[variant] : undefined;
}

/**
 * The banner heading with its last two words marked for the gradient, as in the mockup ("... near you").
 * A heading of two words or fewer is all accent.
 */
export function splitHeadline(text: string): { lead: string; accent: string } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return { lead: "", accent: words.join(" ") };
  return { lead: words.slice(0, -2).join(" "), accent: words.slice(-2).join(" ") };
}

/** The city slug shared by every ad shown, or "" when the ads come from several cities (or any has none). */
export function commonCity(ads: { citySlug?: string }[]): string {
  const first = ads[0]?.citySlug;
  return first && ads.every((ad) => ad.citySlug === first) ? first : "";
}
