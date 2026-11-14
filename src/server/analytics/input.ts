import { z } from "zod";

export const AD_SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;
export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_COUNT_SLUGS = 60;

export const adEventBatchSchema = z
  .object({
    events: z
      .array(z.object({ slug: z.string().regex(AD_SLUG), type: z.enum(["view", "click"]) }).strict())
      .min(1)
      .max(MAX_EVENTS_PER_BATCH),
  })
  .strict();

/** Comma-separated ad slugs, at most MAX_COUNT_SLUGS. Anything that is not a slug is dropped. */
export function parseCountSlugs(raw: string | null): string[] {
  if (!raw) return [];
  const slugs = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => AD_SLUG.test(part));
  return [...new Set(slugs)].slice(0, MAX_COUNT_SLUGS);
}
