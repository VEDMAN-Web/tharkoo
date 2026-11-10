const ALLOWED = /^\/placeholders\//;

export function safePhoto(src?: string | null) {
  if (src && ALLOWED.test(src)) return src;
  return "/placeholders/p1.jpg";
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
