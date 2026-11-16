import { sameSlug } from "@/components/new/band-image";
import type { ShellConfig } from "@/server/site-links/shell-config-rules";

export const DEFAULT_CARD_FOCUS_X = 50;
export const DEFAULT_CARD_FOCUS_Y = 18;

export function photoFocusOf(shell: ShellConfig, scope: "category" | "city", slug: string) {
  const image = shell.media.images.find((item) => item.scope === scope && sameSlug(item.slug, slug));
  return `${image?.focusX ?? DEFAULT_CARD_FOCUS_X}% ${image?.focusY ?? DEFAULT_CARD_FOCUS_Y}%`;
}

export function photoOf(shell: ShellConfig, scope: "category" | "city", slug: string) {
  const image = shell.media.images.find((item) => item.scope === scope && sameSlug(item.slug, slug));
  return image?.photo || image?.band || image?.bandPhone || "";
}
