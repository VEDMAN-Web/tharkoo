const LOCAL = /^\/(placeholders|brand|uploads)\//i;
const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//i;

export function safePhoto(src?: string | null): string | null {
  if (!src) return null;
  const value = src.trim();
  if (LOCAL.test(value) || CLOUDINARY.test(value)) return value;
  return null;
}

export function listingTagSections(tags: unknown) {
  const t = (tags || {}) as Record<string, string | string[] | undefined>;
  const asArr = (v?: string | string[]) => {
    if (!v) return [];
    return (Array.isArray(v) ? v : [v]).filter(Boolean);
  };
  return [
    { title: "", icon: "about" as const, items: [...asArr(t.tag1), ...asArr(t.tag7), ...asArr(t.tag5)] },
    { title: "Offer", icon: "heart" as const, items: asArr(t.tag4) },
    { title: "Hours", icon: "user" as const, items: asArr(t.tag3) },
    { title: "Where", icon: "map" as const, items: asArr(t.tag2) },
  ].filter((s) => s.items.length);
}
