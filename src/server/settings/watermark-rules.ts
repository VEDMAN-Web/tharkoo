import { z } from "zod";

/**
 * H6.18: the watermark settings as plain data and rules. No database here, so the admin screen can import it.
 * The settings themselves are stored by ./watermark.ts.
 */

export const WATERMARK_POSITIONS = ["north_west", "north_east", "south_west", "south_east", "center"] as const;
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];

export interface WatermarkSettings {
  enabled: boolean;
  position: WatermarkPosition;
  /** Percent. 10 is very faint, 100 is solid. */
  opacity: number;
}

/** On by default, bottom right, 60 percent. A missing stored value falls back to these. */
export const WATERMARK_DEFAULTS: WatermarkSettings = { enabled: true, position: "south_east", opacity: 60 };
export const WATERMARK_OPACITY_MIN = 10;
export const WATERMARK_OPACITY_MAX = 100;

export const watermarkBodySchema = z
  .object({
    enabled: z.boolean(),
    position: z.enum(WATERMARK_POSITIONS),
    opacity: z.number().int().min(WATERMARK_OPACITY_MIN).max(WATERMARK_OPACITY_MAX),
  })
  .strict();

/** Pure: a stored value that is missing or out of range falls back to the default for that field. */
export function normaliseWatermark(row: Partial<Record<keyof WatermarkSettings, unknown>> | null | undefined): WatermarkSettings {
  const position = WATERMARK_POSITIONS.find((value) => value === row?.position) ?? WATERMARK_DEFAULTS.position;
  const opacity =
    typeof row?.opacity === "number" && Number.isInteger(row.opacity) && row.opacity >= WATERMARK_OPACITY_MIN && row.opacity <= WATERMARK_OPACITY_MAX
      ? row.opacity
      : WATERMARK_DEFAULTS.opacity;
  return { enabled: typeof row?.enabled === "boolean" ? row.enabled : WATERMARK_DEFAULTS.enabled, position, opacity };
}
