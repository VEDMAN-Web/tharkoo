import { MAX_NAME } from "@/app/admin/_catalog/model";

export const TABS = [
  { key: "details", label: "Details" },
  { key: "pictures", label: "Pictures" },
  { key: "areas", label: "Areas" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export function tabOf(value: string | undefined | null): TabKey {
  return TABS.find((tab) => tab.key === value)?.key ?? "details";
}

export const TYPE_WORD = { city: "city", state: "state", country: "country" } as const;

export type Details = { name: string; slug: string; countryCode: string; order: string; enabled: boolean };
export type DetailsErrors = Partial<Record<"name" | "slug" | "countryCode" | "order", string>>;

export function detailsOf(detail: { name: string; slug: string; countryCode: string; order: number; enabled: boolean }): Details {
  return { name: detail.name, slug: detail.slug, countryCode: detail.countryCode, order: String(detail.order), enabled: detail.enabled };
}

/** What stops a save, field by field. The server checks again. */
export function detailsProblems(draft: Details, type: string): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!draft.name.trim()) errors.name = "Write a name.";
  else if (draft.name.trim().length > MAX_NAME) errors.name = `Keep the name to ${MAX_NAME} characters.`;
  if (!draft.slug.trim()) errors.slug = "Write a web address.";
  if (type === "country" && !/^[A-Za-z]{2}$/.test(draft.countryCode.trim())) errors.countryCode = "Two letters, like IN.";
  const order = Number(draft.order);
  if (draft.order.trim() === "" || !Number.isInteger(order) || order < -9999 || order > 9999) errors.order = "A whole number from -9999 to 9999.";
  return errors;
}

/** Page links keep the search and the page, so Back and a shared link land in the same place. */
export function urlFor(base: { q: string; page: number }, place: string, tab: TabKey): string {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.page > 1) params.set("page", String(base.page));
  if (place) params.set("place", place);
  if (tab !== "details") params.set("tab", tab);
  const text = params.toString();
  return `/admin/locations/${text ? `?${text}` : ""}`;
}

export const TYPE_NAME: Record<string, string> = { city: "City", state: "State", country: "Country" };
