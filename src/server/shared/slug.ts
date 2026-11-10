/** ASCII slug from an admin-edited name. No fixed category list. */
export function toSlug(input: string, max = 80): string {
  const ascii = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, max)
    .replace(/-+$/g, "");
  return slug || "item";
}
