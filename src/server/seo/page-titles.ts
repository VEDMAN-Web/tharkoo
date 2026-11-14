import { connectDb } from "@/lib/db";
import { canonical } from "@/lib/seo";
import {
  TEMPLATE_PAGE_TYPES,
  templateKey,
  type SampleVars,
  type TemplatePageType,
} from "@/lib/seo/landing";
import {
  AD_TITLE_PATTERN,
  CATEGORY_TITLE_DEFAULT,
  PAGE_DESCRIPTION_STORED_MAX,
  PAGE_TITLE_STORED_MAX,
  STATIC_PAGE_DEFAULTS,
  countryDefault,
  sampleVarsFor,
  type TitleText,
} from "@/lib/seo/page-title-defaults";
import {
  adPath,
  blogPath,
  categoryPath,
  citiesPath,
  cleanPath,
  contactPath,
  countryPath,
  helpPath,
  loginPath,
  postAdPath,
  registerPath,
  searchPath,
  type UrlPaths,
} from "@/lib/urls";
import { defaultSiteContent, isAdminRole, readContent } from "@/lib/ui/site-content";
import { PAGE_GROUPS, type PageGroup, type PageTitleRow, type PageTitleTarget } from "@/lib/seo/page-title-defaults";
import { applyHomeSeoChange } from "@/lib/ui/site-store";
import { assertSeoEditor, recordSeo, type SeoActor } from "@/app/admin/seo/staff";
import { DASH_CHARS, DASH_MESSAGE } from "@/server/content/dashes";
import { ForbiddenError, ValidationError } from "@/server/http";
import { loadCountryDirectory } from "@/server/locations/countries";
import { Site, UrlOverride } from "@/server/models";
import { SeoTemplate } from "@/server/models/cms";
import { publicCategories } from "@/server/search/query";
import { getPaths, saveUrlOverride, deleteUrlOverride, overrideFromDoc } from "@/server/urls/service";
import type { OverrideInput } from "@/app/admin/urls/override-rules";
import { deleteTemplate, saveTemplate } from "@/server/seo/templates";
import { textDenied } from "@/server/shared/policy";

export interface PageTitleValues extends TitleText {
  saved: boolean;
}

export interface PageTitleSource {
  siteName: string;
  paths: UrlPaths;
  home: PageTitleValues;
  categories: { slug: string; name: string }[];
  countries: { slug: string; name: string }[];
  templates: TemplateMap;
  overrides: Map<string, { title?: string; description?: string }>;
}

interface StoredTemplate {
  title?: string;
  description?: string;
  h1?: string;
  intro?: string;
}

export type TemplateMap = Map<string, StoredTemplate>;

type OverrideDoc = {
  path?: string;
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  intro?: string;
  faq?: { q?: string; a?: string }[];
};

type StaticEntry = { id: string; group: PageGroup; label: string; path: string; fallback: TitleText };

const SLUG = /^[a-z0-9-]{1,60}$/;
const TEMPLATE_TYPE_KEYS = new Set<string>(TEMPLATE_PAGE_TYPES.map((item) => item.key));
const CONTROL_OR_TAG = /[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g;
const SAMPLE_CATEGORY = "Jobs";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.replace(CONTROL_OR_TAG, "").trim() : "";
}

/** The first non-empty text, or an empty string. */
function pick(...values: (string | undefined)[]) {
  for (const value of values) {
    const text = value?.trim();
    if (text) return text;
  }
  return "";
}

function tpl(pageType: TemplatePageType, categorySlug: string | null): PageTitleTarget {
  return { kind: "template", pageType, categorySlug };
}

/** Refuses a target the editors do not know. Only the three shapes above are accepted. */
export function parsePageTitleTarget(raw: unknown): PageTitleTarget {
  const bad = () => new ValidationError("That page cannot be changed here", { target: ["Unknown page"] });
  if (!raw || typeof raw !== "object") throw bad();
  const value = raw as Record<string, unknown>;
  if (value.kind === "home") return { kind: "home" };
  if (value.kind === "template") {
    const pageType = typeof value.pageType === "string" ? value.pageType : "";
    if (!TEMPLATE_TYPE_KEYS.has(pageType)) throw bad();
    const slug = value.categorySlug === null || value.categorySlug === undefined || value.categorySlug === "" ? null : String(value.categorySlug);
    if (slug !== null && !SLUG.test(slug)) throw bad();
    return { kind: "template", pageType: pageType as TemplatePageType, categorySlug: slug };
  }
  if (value.kind === "url") {
    const raw = typeof value.path === "string" ? value.path.trim() : "";
    // Only a site address such as /jobs/pune/ is accepted; a full web address is refused before cleaning.
    if (!raw || raw.length > 300 || /\s/.test(raw) || raw.includes("://") || !raw.startsWith("/")) throw bad();
    return { kind: "url", path: cleanPath(raw) };
  }
  throw bad();
}

/** Clean text for the title and description, or a ValidationError that names each bad field. */
export function checkPageTitle(input: { title?: unknown; description?: unknown }): TitleText {
  const title = cleanText(input.title);
  const description = cleanText(input.description);
  const problems: Record<string, string[]> = {};
  checkField(problems, "title", title, PAGE_TITLE_STORED_MAX, "Enter a page title");
  checkField(problems, "description", description, PAGE_DESCRIPTION_STORED_MAX, "Enter a page description");
  if (Object.keys(problems).length) throw new ValidationError("Check the highlighted fields", problems);
  return { title, description };
}

function checkField(problems: Record<string, string[]>, key: string, value: string, max: number, emptyMessage: string) {
  if (!value) problems[key] = [emptyMessage];
  else if (value.length > max) problems[key] = [`Keep this to ${max} characters or fewer`];
  else if (DASH_CHARS.test(value)) problems[key] = [DASH_MESSAGE];
  else if (textDenied(value).denied) problems[key] = ["This text contains a word that is not allowed on Tharkoo"];
}

/** Mirrors getSeoFor: the page-type default, then the category's own template wins field by field. */
export function templateChain(pageType: TemplatePageType, categorySlug: string | null, templates: TemplateMap, fallback: TitleText | null): PageTitleValues {
  // District pages fall back to the city and state default when there is no district default.
  const usesCityDefault = pageType === "district" && !templates.has("district");
  const base = usesCityDefault ? templates.get("location") : templates.get(pageType);
  const specific = categorySlug ? templates.get(templateKey(pageType, categorySlug)) : undefined;
  const own = categorySlug ? specific : usesCityDefault ? undefined : base;
  return {
    title: pick(specific?.title, base?.title) || fallback?.title || "",
    description: pick(specific?.description, base?.description) || fallback?.description || "",
    saved: Boolean(pick(own?.title, own?.description)),
  };
}

function staticEntries(paths: UrlPaths): StaticEntry[] {
  return [
    { id: "countries", group: "country", label: "All countries page", path: "/countries/", fallback: STATIC_PAGE_DEFAULTS.countries },
    { id: "cities", group: "static", label: "Cities page", path: citiesPath(paths), fallback: STATIC_PAGE_DEFAULTS.cities },
    { id: "blog", group: "static", label: "Blog page", path: blogPath(paths), fallback: STATIC_PAGE_DEFAULTS.blog },
    { id: "help", group: "static", label: "Help Center", path: helpPath(paths), fallback: STATIC_PAGE_DEFAULTS.help },
    { id: "contact", group: "static", label: "Contact page", path: contactPath(paths), fallback: STATIC_PAGE_DEFAULTS.contact },
    { id: "search", group: "static", label: "Search page", path: searchPath(paths), fallback: STATIC_PAGE_DEFAULTS.search },
    { id: "login", group: "static", label: "Log in page", path: loginPath(paths), fallback: STATIC_PAGE_DEFAULTS.login },
    { id: "register", group: "static", label: "Create account page", path: registerPath(paths), fallback: STATIC_PAGE_DEFAULTS.register },
    { id: "post-ad", group: "static", label: "Post an ad page", path: postAdPath(paths), fallback: STATIC_PAGE_DEFAULTS.postAd },
  ];
}

type RowInput = Omit<PageTitleRow, "groupLabel" | "siteLabel" | "note" | "previewVars"> & { note?: string; previewVars?: SampleVars | null };

function makeRow(input: RowInput): PageTitleRow {
  const { note = "", previewVars = null, ...rest } = input;
  return {
    ...rest,
    groupLabel: PAGE_GROUPS.find((group) => group.id === rest.group)?.label ?? "",
    siteLabel: canonical(rest.address).replace(/^https?:\/\//, ""),
    note,
    previewVars,
  };
}

function urlRow(entry: { id: string; group: PageGroup; label: string; path: string; fallback: TitleText | null }, overrides: PageTitleSource["overrides"]): PageTitleRow {
  const path = cleanPath(entry.path);
  const over = overrides.get(path);
  return makeRow({
    id: `url:${path}`,
    group: entry.group,
    label: entry.label,
    address: path,
    title: pick(over?.title) || entry.fallback?.title || "",
    description: pick(over?.description) || entry.fallback?.description || "",
    saved: Boolean(pick(over?.title, over?.description)),
    target: { kind: "url", path },
  });
}

function templateRow(input: {
  id: string;
  group: PageGroup;
  label: string;
  address: string;
  pageType: TemplatePageType;
  categorySlug: string | null;
  categoryName: string;
  siteName: string;
  templates: TemplateMap;
  fallback: TitleText | null;
  note?: string;
}): PageTitleRow {
  const values = templateChain(input.pageType, input.categorySlug, input.templates, input.fallback);
  return makeRow({
    id: input.id,
    group: input.group,
    label: input.label,
    address: input.address,
    title: values.title,
    description: values.description,
    saved: values.saved,
    target: tpl(input.pageType, input.categorySlug),
    note: input.note,
    previewVars: sampleVarsFor(input.categoryName || SAMPLE_CATEGORY, input.siteName),
  });
}

/** Every page type the Page titles tab lists. Pure: the caller passes the stored data in. */
export function buildPageTitleRows(source: PageTitleSource): PageTitleRow[] {
  const { paths, siteName, templates, overrides } = source;
  const rows: PageTitleRow[] = [];
  rows.push(
    makeRow({
      id: "home",
      group: "home",
      label: "Home page",
      address: "/",
      title: source.home.title,
      description: source.home.description,
      saved: source.home.saved,
      target: { kind: "home" },
      note: "The title and description that Google shows for the home page.",
    }),
  );

  rows.push(
    templateRow({
      id: "template:category",
      group: "category",
      label: "All category pages (default)",
      address: "/{category}/",
      pageType: "category",
      categorySlug: null,
      categoryName: "",
      siteName,
      templates,
      fallback: CATEGORY_TITLE_DEFAULT,
      note: "Used by every category page that has no title of its own.",
    }),
  );
  for (const cat of source.categories) {
    rows.push(
      templateRow({
        id: `template:category:${cat.slug}`,
        group: "category",
        label: cat.name,
        address: categoryPath(cat.slug),
        pageType: "category",
        categorySlug: cat.slug,
        categoryName: cat.name,
        siteName,
        templates,
        fallback: CATEGORY_TITLE_DEFAULT,
      }),
    );
  }

  rows.push(
    templateRow({
      id: "template:location",
      group: "city",
      label: "All city and state pages (default)",
      address: "/{category}/{city}/",
      pageType: "location",
      categorySlug: null,
      categoryName: "",
      siteName,
      templates,
      fallback: null,
      note: "Used by every city and state page that has no title of its own. Words in braces are filled in for each page.",
    }),
  );
  for (const cat of source.categories) {
    rows.push(
      templateRow({
        id: `template:location:${cat.slug}`,
        group: "category-city",
        label: `${cat.name}, every city`,
        address: `/${cat.slug}/{city}/`,
        pageType: "location",
        categorySlug: cat.slug,
        categoryName: cat.name,
        siteName,
        templates,
        fallback: null,
      }),
    );
  }

  rows.push(
    templateRow({
      id: "template:district",
      group: "district",
      label: "All district pages (default)",
      address: "/{category}/{city}/{district}/",
      pageType: "district",
      categorySlug: null,
      categoryName: "",
      siteName,
      templates,
      fallback: null,
      note: "Uses the city and state default until a district title is saved.",
    }),
  );
  for (const cat of source.categories) {
    rows.push(
      templateRow({
        id: `template:district:${cat.slug}`,
        group: "district",
        label: `${cat.name}, every district`,
        address: `/${cat.slug}/{city}/{district}/`,
        pageType: "district",
        categorySlug: cat.slug,
        categoryName: cat.name,
        siteName,
        templates,
        fallback: null,
      }),
    );
  }

  rows.push(
    templateRow({
      id: "template:subcategory",
      group: "subcategory",
      label: "All sub-category pages (default)",
      address: "/{category}/{city}/{sub-category}/",
      pageType: "subcategory",
      categorySlug: null,
      categoryName: "",
      siteName,
      templates,
      fallback: null,
      note: "Sub-category pages use the copy built into the page until a title is saved.",
    }),
  );
  for (const cat of source.categories) {
    rows.push(
      templateRow({
        id: `template:subcategory:${cat.slug}`,
        group: "subcategory",
        label: `${cat.name}, every sub-category`,
        address: `/${cat.slug}/{city}/{sub-category}/`,
        pageType: "subcategory",
        categorySlug: cat.slug,
        categoryName: cat.name,
        siteName,
        templates,
        fallback: null,
      }),
    );
  }

  rows.push(
    makeRow({
      id: "ad",
      group: "ad",
      label: "Ad pages",
      address: adPath(paths, "ad-name").replace("ad-name", "{ad name}"),
      title: AD_TITLE_PATTERN,
      description: "",
      saved: false,
      target: null,
      note: "Built into the ad page: the ad's own title, city and category fill in the words. Each ad title is set on the ad, so this is not editable here.",
    }),
  );

  for (const entry of staticEntries(paths).filter((item) => item.group === "country")) rows.push(urlRow(entry, overrides));
  for (const country of source.countries) {
    rows.push(
      urlRow({ id: `country:${country.slug}`, group: "country", label: country.name, path: countryPath(country.slug), fallback: countryDefault(country.name) }, overrides),
    );
  }
  for (const entry of staticEntries(paths).filter((item) => item.group === "static")) rows.push(urlRow(entry, overrides));

  return rows;
}

async function loadTemplateMap(): Promise<TemplateMap> {
  await connectDb();
  const rows = await SeoTemplate.find().lean<{ pageType?: string; title?: string; description?: string; h1?: string; intro?: string }[]>();
  return new Map(rows.filter((row) => row.pageType).map((row) => [row.pageType as string, { title: row.title, description: row.description, h1: row.h1, intro: row.intro }]));
}

async function loadOverrides(): Promise<PageTitleSource["overrides"]> {
  await connectDb();
  const rows = await UrlOverride.find().select("path title description").lean<{ path?: string; title?: string; description?: string }[]>();
  return new Map(rows.filter((row) => row.path).map((row) => [cleanPath(row.path as string), { title: row.title, description: row.description }]));
}

/** The home page text as the public page reads it, and whether it differs from the built-in copy. */
async function homeValues(homepage: unknown): Promise<PageTitleValues> {
  const content = readContent(homepage);
  const built = defaultSiteContent();
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    saved: content.seoTitle !== built.seoTitle || content.seoDescription !== built.seoDescription,
  };
}

/** Every page type with its current title and description, in the order the tab shows them. */
export async function listPageTitles(): Promise<PageTitleRow[]> {
  const paths = await getPaths();
  await connectDb();
  const [site, categories, countries, templates, overrides] = await Promise.all([
    Site.findOne({ key: "default" }).select("name homepage").lean<{ name?: string; homepage?: unknown } | null>(),
    publicCategories(),
    loadCountryDirectory(),
    loadTemplateMap(),
    loadOverrides(),
  ]);
  return buildPageTitleRows({
    siteName: site?.name || "Tharkoo",
    paths,
    home: await homeValues(site?.homepage),
    categories: categories.filter((cat) => cat.slug).map((cat) => ({ slug: cat.slug as string, name: cat.name })),
    countries: countries.map((country) => ({ slug: country.slug, name: country.name })),
    templates,
    overrides,
  });
}

async function findOverride(path: string) {
  await connectDb();
  const doc = await UrlOverride.findOne({ path: cleanPath(path) }).lean<OverrideDoc | null>();
  return doc ? overrideFromDoc(doc) : null;
}

/** The title and description a page shows now (saved, inherited or built in), for the editors. */
export async function readPageTitle(target: PageTitleTarget): Promise<PageTitleValues> {
  if (target.kind === "home") {
    await connectDb();
    const site = await Site.findOne({ key: "default" }).select("homepage").lean<{ homepage?: unknown } | null>();
    return homeValues(site?.homepage);
  }
  if (target.kind === "template") {
    const fallback = target.pageType === "category" ? CATEGORY_TITLE_DEFAULT : null;
    return templateChain(target.pageType, target.categorySlug, await loadTemplateMap(), fallback);
  }
  const path = cleanPath(target.path);
  const over = await findOverride(path);
  const fallback = staticEntries(await getPaths()).find((entry) => cleanPath(entry.path) === path)?.fallback ?? null;
  return {
    title: pick(over?.title) || fallback?.title || "",
    description: pick(over?.description) || fallback?.description || "",
    saved: Boolean(pick(over?.title, over?.description)),
  };
}

async function saveTemplateText(actor: SeoActor, target: Extract<PageTitleTarget, { kind: "template" }>, text: TitleText) {
  await connectDb();
  const stored = await SeoTemplate.findOne({ pageType: templateKey(target.pageType, target.categorySlug) }).lean<StoredTemplate | null>();
  await saveTemplate(actor, {
    pageType: target.pageType,
    categorySlug: target.categorySlug,
    // h1 and intro are kept as they are; only the title and description change.
    fields: { h1: stored?.h1 ?? "", intro: stored?.intro ?? "", ...text },
  });
}

async function saveOverrideText(actor: SeoActor, path: string, text: TitleText) {
  const current = await findOverride(path);
  const next: OverrideInput = { ...(current ?? { path }), path, title: text.title, description: text.description };
  const out = await saveUrlOverride(next);
  await recordSeo(actor, "seo.override.save", "url-override", out.after.path, out.before ?? {}, out.after);
}

/** Saves the title and description. Any SEO editor; the home page needs an admin. Audited, refuses bad text. */
export async function savePageTitle(actor: SeoActor, target: PageTitleTarget, input: { title?: unknown; description?: unknown }): Promise<TitleText> {
  assertSeoEditor(actor);
  const text = checkPageTitle(input);
  if (target.kind === "home") {
    await applyHomeSeoChange({ roles: actor.roles, email: actor.email, seoTitle: text.title, seoDescription: text.description });
  } else if (target.kind === "template") {
    await saveTemplateText(actor, target, text);
  } else {
    await saveOverrideText(actor, target.path, text);
  }
  return text;
}

/** The editors on the Listing pages and Post-ad pages: admins only, otherwise the same rules as savePageTitle. */
export async function savePageTitleForEditor(actor: SeoActor, target: PageTitleTarget, input: { title?: unknown; description?: unknown }) {
  if (!isAdminRole(actor.roles)) throw new ForbiddenError("Only an admin can change the page title here");
  return savePageTitle(actor, target, input);
}

async function resetTemplate(actor: SeoActor, target: Extract<PageTitleTarget, { kind: "template" }>) {
  const key = templateKey(target.pageType, target.categorySlug);
  await connectDb();
  const stored = await SeoTemplate.findOne({ pageType: key }).lean<StoredTemplate | null>();
  // A category's own row with nothing else in it is removed, so the category inherits the default again.
  if (target.categorySlug && !stored?.h1 && !stored?.intro) {
    await deleteTemplate(actor, key);
    return;
  }
  await saveTemplate(actor, {
    pageType: target.pageType,
    categorySlug: target.categorySlug,
    fields: { title: "", description: "", h1: stored?.h1 ?? "", intro: stored?.intro ?? "" },
  });
}

async function resetOverride(actor: SeoActor, path: string) {
  const current = await findOverride(path);
  if (!current) return;
  const hasOtherContent = Boolean(current.h1 || current.canonical || current.ogImage || current.intro || current.noindex || current.faq.length);
  if (!hasOtherContent) {
    const out = await deleteUrlOverride(path);
    await recordSeo(actor, "seo.override.delete", "url-override", path, out.before ?? {}, {});
    return;
  }
  const out = await saveUrlOverride({ ...current, title: "", description: "" });
  await recordSeo(actor, "seo.override.save", "url-override", out.after.path, out.before ?? {}, out.after);
}

/** Clears the saved title and description, so the page falls back to its template or built-in copy. */
export async function resetPageTitle(actor: SeoActor, target: PageTitleTarget): Promise<PageTitleValues> {
  assertSeoEditor(actor);
  if (target.kind === "home") {
    const built = defaultSiteContent();
    await applyHomeSeoChange({ roles: actor.roles, email: actor.email, seoTitle: built.seoTitle, seoDescription: built.seoDescription });
  } else if (target.kind === "template") {
    await resetTemplate(actor, target);
  } else {
    await resetOverride(actor, target.path);
  }
  return readPageTitle(target);
}
