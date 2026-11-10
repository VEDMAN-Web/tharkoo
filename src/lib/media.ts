const LOCAL = /^\/(placeholders|brand|uploads)\//i;
const CLOUDINARY = /^https:\/\/res\.cloudinary\.com\//i;

const PEOPLE = new Set(["dating", "friendship", "meetups", "personal-ads", "wellness"]);

function mix(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (Math.imul(n, 33) + id.charCodeAt(i)) >>> 0;
  return n;
}

/** Four different 4:5 portraits, rotated by ad id. Null for other categories. */
export function peoplePortraits(category: string | undefined, id: string): string[] | null {
  if (!category || !PEOPLE.has(category)) return null;
  const start = mix(id || category) % 12;
  return [0, 1, 2, 3].map((offset) => {
    const num = ((start + offset) % 12) + 1;
    return `/placeholders/profiles/${String(num).padStart(2, "0")}.webp`;
  });
}

/** Real uploads win. People listings without one show the portrait set. */
export function listingPhotos(category: string | undefined, id: string, photos: (string | null | undefined)[]) {
  const list = photos.filter((photo): photo is string => Boolean(photo));
  const portraits = peoplePortraits(category, id);
  if (!portraits) return list;
  const own = list.filter((photo) => !photo.startsWith("/placeholders/"));
  return own.length ? own : portraits;
}

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
