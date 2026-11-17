/** The parts of "Add takedown" that the browser and the server share. */

export const TAKEDOWN_CHANNELS = ["email", "letter", "other"] as const;
export type TakedownChannel = (typeof TAKEDOWN_CHANNELS)[number];

/** The due time starts this many hours after the request was received. */
export const DEFAULT_DUE_HOURS = 36;

/** The ad a pasted link or id points to: the last piece of a link is the ad's address, or its id. */
export function adKeyOf(text: string): string {
  const clean = String(text ?? "").trim();
  if (!clean) return "";
  const path = /^https?:\/\//i.test(clean)
    ? (() => {
        try {
          return new URL(clean).pathname;
        } catch {
          return clean;
        }
      })()
    : clean;
  return path.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "";
}
