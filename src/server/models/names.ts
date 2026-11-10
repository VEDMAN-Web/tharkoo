/** Flipped in T5.1. Clashing models now use the canonical names and collections. */
export const V2 = "";
export const COLL_SUFFIX = "";

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
