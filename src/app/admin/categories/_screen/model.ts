import type { PicturesView } from "@/server/layout/catalog-pictures";

export const TABS = [
  { key: "details", label: "Details" },
  { key: "pictures", label: "Pictures" },
  { key: "fields", label: "Form fields" },
  { key: "subs", label: "Sub-categories" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export function tabOf(value: string | undefined | null): TabKey {
  return TABS.find((tab) => tab.key === value)?.key ?? "details";
}

/** Kinds an admin chooses from. There is no preselected value: a category needs one before it can be saved (H6.5). */
export const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "goods", label: "Goods" },
  { value: "property", label: "Property" },
  { value: "vehicle", label: "Vehicle" },
  { value: "job", label: "Job" },
  { value: "service", label: "Service" },
  { value: "people", label: "People (no live video tours)" },
];

export const KIND_HELP = "Decides the rules of the post form. People categories ask for an age check and have no live video tours.";
export const KIND_MISSING = "Choose a kind to save.";

export const MAX_NAME = 80;
export const MAX_INTRO = 600;
export const MAX_HOME_LINE = 160;
export const MAX_ALT = 125;
export const MIN_ALT = 3;

export type Details = {
  name: string;
  slug: string;
  kind: string;
  icon: string;
  importMaxPhotos: string;
  seoIntro: string;
  homeLine: string;
  enabled: boolean;
};

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

export function detailsOf(detail: { name: string; slug: string; kind: string; icon: string; importMaxPhotos: number | null; seoIntro: string; homeLine: string; enabled: boolean }): Details {
  return {
    name: detail.name,
    slug: detail.slug,
    kind: detail.kind,
    icon: detail.icon,
    importMaxPhotos: detail.importMaxPhotos === null ? "" : String(detail.importMaxPhotos),
    seoIntro: detail.seoIntro,
    homeLine: detail.homeLine,
    enabled: detail.enabled,
  };
}

export type DetailsErrors = Partial<Record<"name" | "slug" | "kind" | "importMaxPhotos" | "seoIntro" | "homeLine", string>>;

/** What stops a save, field by field. The server checks again. */
export function detailsProblems(draft: Details): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!draft.name.trim()) errors.name = "Write a name.";
  else if (draft.name.trim().length > MAX_NAME) errors.name = `Keep the name to ${MAX_NAME} characters.`;
  if (!draft.slug.trim()) errors.slug = "Write a web address.";
  if (!draft.kind) errors.kind = KIND_MISSING;
  if (draft.importMaxPhotos.trim() !== "") {
    const count = Number(draft.importMaxPhotos);
    if (!Number.isInteger(count) || count < 1 || count > 30) errors.importMaxPhotos = "A whole number from 1 to 30, or leave it blank.";
  }
  if (draft.seoIntro.length > MAX_INTRO) errors.seoIntro = `Keep it to ${MAX_INTRO} characters.`;
  if (draft.homeLine.length > MAX_HOME_LINE) errors.homeLine = `Keep it to ${MAX_HOME_LINE} characters.`;
  return errors;
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
