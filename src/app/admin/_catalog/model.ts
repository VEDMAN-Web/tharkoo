import type { PicturesView } from "@/server/layout/catalog-pictures";

/** Shared by Categories & fields and Cities & areas (H8.52): the picture drafts, their checks, and two small word helpers. */

export const MAX_NAME = 80;
export const MAX_ALT = 125;
export const MIN_ALT = 3;

export type PictureSlot = {
  image: { assetId: string; src: string; alt: string; width: number; height: number } | null;
  alt: string;
  focusX: number;
  focusY: number;
};

export type PictureDraft = { photo: PictureSlot; band: PictureSlot; phone: PictureSlot["image"] };

const EMPTY_SLOT: PictureSlot = { image: null, alt: "", focusX: 50, focusY: 50 };

export function slotOf(view: PicturesView["photo"] | PicturesView["band"]): PictureSlot {
  return view ? { image: view.image, alt: view.image.alt, focusX: view.focusX, focusY: view.focusY } : EMPTY_SLOT;
}

export function picturesOf(view: PicturesView): PictureDraft {
  return { photo: slotOf(view.photo), band: slotOf(view.band), phone: view.band?.phone ?? null };
}

export type PictureErrors = Partial<Record<"photo" | "band" | "phone", string>>;

export function picturesProblems(draft: PictureDraft): PictureErrors {
  const errors: PictureErrors = {};
  for (const key of ["photo", "band"] as const) {
    const slot = draft[key];
    if (!slot.image) continue;
    const length = slot.alt.trim().length;
    if (length < MIN_ALT) errors[key] = "Describe the picture in a few words.";
    else if (length > MAX_ALT) errors[key] = `Use at most ${MAX_ALT} characters.`;
  }
  if (draft.phone && !draft.band.image) errors.phone = "Add the wide top banner first. The phone picture goes with it.";
  return errors;
}

/** "3,105 ads", "1 ad", "No ads". */
export function adsText(count: number): string {
  if (count === 0) return "No ads";
  return `${count.toLocaleString("en-IN")} ${count === 1 ? "ad" : "ads"}`;
}

/** A web address from a name: lower case words joined by dashes. */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
