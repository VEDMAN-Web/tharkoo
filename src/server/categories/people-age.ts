import { isPeopleListing } from "@/server/categories/kinds";
import type { FieldDefinition } from "@/server/shared/fields";

/** H10.1: the age every people ad carries (18 to 99) when its category's own form has no age field, so renaming a people category cannot drop the adults-only check. */
export const PEOPLE_AGE_FIELD: FieldDefinition = { key: "age", label: "Age", type: "number", required: true, options: [], min: 18, max: 99, unit: "", order: 9999, enabled: true };

export function withPeopleAge(category: { slug?: string; kind?: string; fields?: unknown }, defs: FieldDefinition[]): FieldDefinition[] {
  if (!isPeopleListing(category) || defs.some((def) => def.key === "age")) return defs;
  return [...defs, PEOPLE_AGE_FIELD];
}
