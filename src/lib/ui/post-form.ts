export type PostField = { key: string; label: string; required?: boolean };

export type PostDraftInput = {
  categoryId: string;
  /** Needed only when the category has sub-categories. */
  subcategoryId?: string;
  needsSubcategory?: boolean;
  cityId: string;
  nickname: string;
  title: string;
  text: string;
  phone: string;
  contactMode: string;
  age: string;
  ageRequired?: boolean;
  terms: boolean;
  adult: boolean;
  attrs: Record<string, string>;
  fields: PostField[];
};

export function validatePost(input: PostDraftInput) {
  const next: Record<string, string> = {};
  if (!input.categoryId) next.category = "Please, fill in this field";
  if (input.needsSubcategory && !input.subcategoryId) next.subcategory = "Please, fill in this field";
  if (!input.cityId) next.city = "Please, fill in this field";
  if (!input.nickname.trim()) next.nickname = "Name / Nickname is required";
  const alnum = (input.title.match(/[a-z0-9]/gi) || []).length;
  if (input.title.trim().length < 5 || alnum < 5) next.title = "You must enter at least 5 alphanumeric characters (a,b,c...z,0,1,2,3...)";
  if (input.text.trim().length < 20) next.text = "You must enter at least 20 characters";
  if (input.contactMode !== "email" && !input.phone.replace(/[\s-]/g, "")) next.phone = "If you want to be contacted by phone, please fill in this field";
  if (input.ageRequired && !input.age.trim()) next.age = "Please, fill in this field";
  else if (input.age && (Number(input.age) < 18 || Number(input.age) > 120)) next.age = "Invalid field";
  if (!input.terms) next.terms = "Please, fill in this field";
  if (!input.adult) next.adult = "Please, fill in this field";
  for (const field of input.fields) {
    if (!field.required || field.key === "age") continue;
    if (!String(input.attrs[field.key] || "").trim()) next[field.key] = "Please, fill in this field";
  }
  return next;
}

export type SavedDraft = {
  title?: string | null;
  description?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  cityId?: string | null;
  districtId?: string | null;
  attributes?: Record<string, unknown> | null;
  nickname?: string | null;
  contact?: { phone?: string | null; whatsapp?: string | null; telegram?: string | null } | null;
  mediaIds?: string[] | null;
};

export function draftToForm(row: SavedDraft) {
  const attributes = row.attributes || {};
  const attrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "age" || value === undefined || value === null) continue;
    attrs[key] = String(value);
  }
  return {
    title: row.title || "",
    text: row.description || "",
    categoryId: row.categoryId || "",
    subcategoryId: row.subcategoryId || "",
    cityId: row.cityId || "",
    districtId: row.districtId || "",
    age: attributes.age === undefined || attributes.age === null ? "" : String(attributes.age),
    nickname: row.nickname || (typeof attributes.nickname === "string" ? attributes.nickname : ""),
    address: typeof attributes.address === "string" ? attributes.address : "",
    postal: typeof attributes.postal === "string" ? attributes.postal : "",
    area: typeof attributes.area === "string" ? attributes.area : "",
    phone: row.contact?.phone || "",
    whatsapp: Boolean(row.contact?.whatsapp),
    telegram: row.contact?.telegram || "",
    lookingFor: attrs["looking-for"] || "",
    attrs,
    photos: row.mediaIds || [],
  };
}

export function needsIdCheck(status?: string | null) {
  return Boolean(status) && status !== "approved";
}
