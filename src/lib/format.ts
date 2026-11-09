export function prettyPlace(slug?: string | null) {
  if (!slug) return "";
  return slug
    .split("-")
    .filter((part) => part && part !== "region")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
