import { MAX_ALT, MIN_ALT, MAX_NAME, slotOf, picturesOf, picturesProblems, adsText, slugFromName } from "@/app/admin/_catalog/model";
export type { PictureSlot, PictureDraft, PictureErrors } from "@/app/admin/_catalog/model";
export { MAX_ALT, MIN_ALT, MAX_NAME, slotOf, picturesOf, picturesProblems, adsText, slugFromName };

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

export const MAX_INTRO = 600;
export const MAX_HOME_LINE = 160;
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

