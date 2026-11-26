import { connectDb } from "@/lib/db";
import {
  TEMPLATE_FIELDS,
  TEMPLATE_LIMITS,
  TEMPLATE_PAGE_TYPES,
  mergeTemplates,
  renderTemplate,
  splitTemplateKey,
  templateKey,
  unknownVariables,
  type TemplateFields,
  type TemplatePageType,
} from "@/lib/seo/landing";
import { assertSeoEditor, recordSeo, type SeoActor } from "@/app/admin/seo/staff";
import { ValidationError } from "@/server/http";
import { DASH_CHARS, DASH_MESSAGE } from "@/server/content/dashes";
import { SeoTemplate } from "@/server/models/cms";
import { textDenied } from "@/server/shared/policy";

export interface TemplateInput {
  pageType: string;
  categorySlug?: string | null;
  fields: Partial<TemplateFields>;
}

export interface StoredTemplate {
  key: string;
  pageType: string;
  categorySlug: string | null;
  fields: TemplateFields;
}

const SLUG = /^[a-z0-9-]{1,60}$/;
/** The sub-category hub page type (H6.2b). It uses the same four fields as the other hubs. */
export const SUBCATEGORY_PAGE_TYPE = "subcategory";
const PAGE_KEYS = new Set<string>([...TEMPLATE_PAGE_TYPES.map((item) => item.key), SUBCATEGORY_PAGE_TYPE]);
// eslint-disable-next-line no-control-regex
const CONTROL_OR_TAG = /[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g;

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(CONTROL_OR_TAG, "").trim() : "";
}

/** Throws a ValidationError with one message per bad field; returns clean values. */
export function validateTemplate(input: TemplateInput): { key: string; fields: TemplateFields } {
  const problems: Record<string, string[]> = {};
  if (!PAGE_KEYS.has(input.pageType)) problems.pageType = ["Choose a page type from the list"];
  const slug = input.categorySlug ? String(input.categorySlug) : null;
  if (slug && !SLUG.test(slug)) problems.categorySlug = ["Category is not valid"];
  const fields = {} as TemplateFields;
  for (const name of TEMPLATE_FIELDS) {
    const value = clean(input.fields?.[name]);
    fields[name] = value;
    if (value.length > TEMPLATE_LIMITS[name]) {
      problems[name] = [`Keep this to ${TEMPLATE_LIMITS[name]} characters or fewer`];
    } else if (DASH_CHARS.test(value)) {
      problems[name] = [DASH_MESSAGE];
    } else if (textDenied(value).denied) {
      problems[name] = ["This text contains a word that is not allowed on Tharkoo"];
    } else if (unknownVariables(value).length) {
      problems[name] = [`Unknown variable: ${unknownVariables(value).map((v) => `{${v}}`).join(", ")}`];
    }
  }
  if (Object.keys(problems).length) throw new ValidationError("Check the highlighted fields", problems);
  return { key: templateKey(input.pageType as TemplatePageType, slug), fields };
}

export async function listTemplates(): Promise<StoredTemplate[]> {
  await connectDb();
  const rows = await SeoTemplate.find().sort({ pageType: 1 }).lean();
  return rows
    .filter((row) => row.pageType && PAGE_KEYS.has(splitTemplateKey(row.pageType).pageType))
    .map((row) => ({
      key: row.pageType as string,
      ...splitTemplateKey(row.pageType as string),
      fields: { title: row.title ?? "", description: row.description ?? "", h1: row.h1 ?? "", intro: row.intro ?? "" },
    }));
}

export async function saveTemplate(actor: SeoActor, input: TemplateInput) {
  assertSeoEditor(actor);
  const { key, fields } = validateTemplate(input);
  await connectDb();
  const before = await SeoTemplate.findOne({ pageType: key }).lean();
  await SeoTemplate.updateOne({ pageType: key }, { $set: { pageType: key, ...fields } }, { upsert: true });
  await recordSeo(actor, "seo.template.save", "seo-template", key, before ?? {}, fields);
  return { key };
}

/** Only category-specific templates can be removed; the page-type defaults stay. */
export async function deleteTemplate(actor: SeoActor, key: string) {
  assertSeoEditor(actor);
  const { categorySlug } = splitTemplateKey(key);
  if (!categorySlug) throw new ValidationError("The default template cannot be deleted", { key: ["Only category templates can be deleted"] });
  await connectDb();
  const before = await SeoTemplate.findOne({ pageType: key }).lean();
  await SeoTemplate.deleteOne({ pageType: key });
  await recordSeo(actor, "seo.template.delete", "seo-template", key, before ?? {}, {});
  return { key };
}

export interface SubcategoryCopy {
  title: string;
  description: string;
  h1: string;
  intro: string;
}

/**
 * Copy for a sub-category page from the "subcategory" template (the category's own one wins field by field).
 * {category} is filled with the sub-category name. Empty template fields keep the built-in copy in `fallback`.
 */
export async function subcategoryCopy(
  categorySlug: string,
  vars: { subcategory: string; city: string; count?: number; site: string },
  fallback: SubcategoryCopy,
): Promise<SubcategoryCopy> {
  await connectDb();
  const rows = await SeoTemplate.find({ pageType: { $in: [SUBCATEGORY_PAGE_TYPE, `${SUBCATEGORY_PAGE_TYPE}:${categorySlug}`] } }).lean();
  const pick = (key: string) => rows.find((row) => row.pageType === key) ?? null;
  const merged = mergeTemplates(pick(SUBCATEGORY_PAGE_TYPE), pick(`${SUBCATEGORY_PAGE_TYPE}:${categorySlug}`));
  if (!merged) return fallback;
  const fill = (text: string | undefined, fall: string) => {
    const out = text ? renderTemplate(text, { category: vars.subcategory, city: vars.city, count: vars.count, site: vars.site }).replace(/\s+/g, " ").trim() : "";
    return out || fall;
  };
  return {
    title: fill(merged.title, fallback.title),
    description: fill(merged.description, fallback.description),
    h1: fill(merged.h1, fallback.h1),
    intro: fill(merged.intro, fallback.intro),
  };
}
