export const MEDIA_TABS = ["pictures", "unused", "missing", "trash"] as const;
export type MediaTab = (typeof MEDIA_TABS)[number];
export const MEDIA_PAGE_SIZE = 24;

export function parseMediaTab(value: string): MediaTab {
  return (MEDIA_TABS as readonly string[]).includes(value) ? (value as MediaTab) : "pictures";
}
