export const TABS = [
  { key: "home", label: "Home" },
  { key: "listing", label: "Listing pages" },
  { key: "post", label: "Post-ad page" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

/** The tab the address names (?tab=listing); anything else opens Home. */
export function tabOf(value: string | undefined | null): TabKey {
  return TABS.find((tab) => tab.key === value)?.key ?? "home";
}
