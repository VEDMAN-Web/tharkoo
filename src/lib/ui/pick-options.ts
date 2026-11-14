/** Pure helpers for the post-ad chips: the picks after a press, and the chips to draw. No React here, so tests can import it. */

/** Above this many options the group shows a search box. */
export const PICK_SEARCH_THRESHOLD = 20;
/** Most chips drawn at once. The rest appear as the visitor types. */
export const PICK_SHOW_LIMIT = 40;

/** The picks after one chip is pressed. Pick-one replaces the pick; pick-many stops at the limit. */
export function togglePick(selected: string[], option: string, mode: "many" | "one", max: number): string[] {
  if (selected.includes(option)) return selected.filter((item) => item !== option);
  if (mode === "one") return [option];
  return selected.length < max ? [...selected, option] : selected;
}

/** The chips to draw: picks first, then the options that match the search (up to the show limit). */
export function visibleOptions(options: string[], selected: string[], query: string) {
  const needle = query.trim().toLowerCase();
  const matches = needle ? options.filter((option) => option.toLowerCase().includes(needle)) : options;
  const picked = selected.filter((item) => options.includes(item));
  const rest = matches.filter((option) => !selected.includes(option));
  return {
    chips: [...picked, ...rest].slice(0, PICK_SHOW_LIMIT),
    matches: matches.length,
  };
}
