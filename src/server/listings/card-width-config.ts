/** H6.17: card width choices. Pure (no database), so admin screens can import it. */
export const CARD_WIDTHS = ["narrow", "medium", "full"] as const;
export type CardWidth = (typeof CARD_WIDTHS)[number];
export const DEFAULT_CARD_WIDTH: CardWidth = "medium";

export const CARD_WIDTH_LABELS: Record<CardWidth, string> = {
  narrow: "Narrow (760 px)",
  medium: "Medium (880 px, default)",
  full: "Full width",
};

/** Missing or unknown values fall back to the default. */
export function cardWidthFrom(value: unknown): CardWidth {
  return typeof value === "string" && (CARD_WIDTHS as readonly string[]).includes(value) ? (value as CardWidth) : DEFAULT_CARD_WIDTH;
}
