/** Coexistence with src/lib/models.ts until T5.1 flips these two constants. */
export const V2 = "V2";
export const COLL_SUFFIX = "_v2";

/** Model names that already exist on the pre-T1.1 Mongoose connection. */
export const CLASHING_MODELS = new Set([
  "Category",
  "Location",
  "Listing",
  "Coupon",
  "Product",
  "CreditPack",
  "Site",
  "Page",
  "HelpArticle",
  "BlogPost",
  "Banner",
  "BannedWord",
  "FeatureFlag",
  "AttributeGroup",
  "SeoTemplate",
]);

export function modelName(base: string): string {
  return CLASHING_MODELS.has(base) ? `${base}${V2}` : base;
}

export function collectionName(collection: string, base: string): string {
  return CLASHING_MODELS.has(base) ? `${collection}${COLL_SUFFIX}` : collection;
}
