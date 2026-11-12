/**
 * The pin scope for a page picked in the admin: "home", "hub:<category>", "hub:<category>/<city>"
 * or "hub:<category>/<city>/<district>". A district only counts when a city is chosen.
 */
export function scopeFromParts(category: string, city: string, district: string) {
  if (!category) return "home";
  const parts = [category, ...(city ? [city, ...(district ? [district] : [])] : [])];
  return `hub:${parts.join("/")}`;
}
