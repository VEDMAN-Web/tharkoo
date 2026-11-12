import { connectDb } from "@/lib/db";
import { refreshPublicCache } from "@/lib/cache";
import { TAG_PAGES } from "@/data/catalog";
import {
  cleanPath,
  decidePath,
  followTarget,
  joinAdSlug,
  readPaths,
  splitAdSlug,
  validatePrefix,
  validateSlug,
  type PathKey,
  type RedirectRule,
  type UrlPaths,
} from "@/lib/urls";
import { ValidationError } from "@/server/http";
import { siteUrl } from "@/lib/utils";
import {
  diffOverride,
  normalizeOverride,
  overrideRowsFromCsv,
  type DiffStatus,
  type OverrideClean,
  type OverrideInput,
} from "@/app/admin/urls/override-rules";
import { BlogPost, Category, Location, Page, Redirect, Site, UrlOverride, Listing } from "@/server/models";

type StoredRule = RedirectRule & { hits: number; enabled: boolean };

let cache: { at: number; paths: UrlPaths; rules: StoredRule[] } | null = null;

export function invalidateUrlCache() {
  cache = null;
}

async function refreshPublic() {
  invalidateUrlCache();
  await refreshPublicCache();
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/sitemap.xml");
    for (const shard of ["categories", "cities", "districts", "tags", "ads", "content"]) revalidatePath(`/sitemap/${shard}`);
  } catch {
    /* tests and scripts have no Next request store */
  }
}

export async function getUrlTable() {
  if (cache && Date.now() - cache.at < 15_000) return cache;
  await connectDb();
  const [site, rows] = await Promise.all([
    Site.findOne({ key: "default" }).select("paths").lean<{ paths?: unknown }>(),
    Redirect.find({ enabled: { $ne: false } }).select("fromPath toPath hits").lean<StoredRedirect[]>(),
  ]);
  const paths = readPaths(site?.paths);
  const rules = rows.map((row) => ({
    id: String(row._id),
    from: row.fromPath,
    to: row.toPath,
    hits: row.hits || 0,
    enabled: true,
  }));
  cache = { at: Date.now(), paths, rules };
  return cache;
}

type StoredRedirect = { _id?: unknown; fromPath: string; toPath: string; hits?: number };

export async function getPaths() {
  return (await getUrlTable()).paths;
}

export async function decideRequest(pathname: string) {
  const table = await getUrlTable();
  return decidePath(pathname, table.paths, table.rules);
}

export async function countRedirectHit(id: string | undefined) {
  if (!id) return;
  await connectDb();
  await Redirect.updateOne({ _id: id }, { $inc: { hits: 1 } });
}

async function rulesNow() {
  await connectDb();
  const rows = await Redirect.find().lean<StoredRedirect[]>();
  return rows.map((row) => ({ id: String(row._id), from: row.fromPath, to: row.toPath }));
}

export async function saveRedirect(from: string, to: string) {
  const source = cleanPath(from.includes("*") ? from.replace(/\*$/, "") : from);
  const storedFrom = from.includes("*") ? `${source}*` : source;
  const dest = cleanPath(to.includes("*") ? to.replace(/\*$/, "") : to);
  const storedTo = to.includes("*") ? `${dest}*` : dest;
  if (storedFrom === storedTo) throw new Error("The old and new URLs are the same.");
  await Redirect.deleteMany({ fromPath: storedFrom, toPath: storedFrom });
  const existing = await rulesNow();
  const target = followTarget(storedFrom, storedTo, existing.filter((rule) => rule.from !== storedFrom));
  if (cleanPath(target.replace(/\*$/, "")) === cleanPath(storedFrom.replace(/\*$/, ""))) {
    throw new Error("That redirect would loop.");
  }
  await Redirect.updateMany({ toPath: storedFrom }, { $set: { toPath: target } });
  await Redirect.updateOne({ fromPath: storedFrom }, { $set: { toPath: target, enabled: true }, $setOnInsert: { hits: 0 } }, { upsert: true });
  await refreshPublic();
}

export async function updateRedirect(id: string, to: string) {
  await connectDb();
  const row = await Redirect.findById(id);
  if (!row) throw new Error("Redirect not found.");
  await saveRedirect(row.fromPath, to);
}

export async function deleteRedirect(id: string) {
  await connectDb();
  await Redirect.deleteOne({ _id: id });
  await refreshPublic();
}

export async function listRedirects() {
  await connectDb();
  return Redirect.find().sort({ updatedAt: -1 }).limit(200).lean();
}

export function redirectsToCsv(rows: { fromPath?: string; toPath?: string; enabled?: boolean; hits?: number }[]) {
  const lines = ["from,to,enabled,hits"];
  for (const row of rows) {
    lines.push([row.fromPath || "", row.toPath || "", row.enabled === false ? "false" : "true", String(row.hits || 0)].join(","));
  }
  return lines.join("\n");
}

export async function importRedirectCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  let count = 0;
  for (const line of lines) {
    if (line.toLowerCase().startsWith("from,")) continue;
    const [from, to] = line.split(",").map((part) => part.trim());
    if (!from || !to) continue;
    await saveRedirect(from, to);
    count += 1;
  }
  return count;
}

async function clearReverseRedirect(from: string, to: string) {
  const source = `${cleanPath(from.replace(/\*$/, ""))}${from.includes("*") ? "*" : ""}`;
  const dest = `${cleanPath(to.replace(/\*$/, ""))}${to.includes("*") ? "*" : ""}`;
  await Redirect.deleteMany({ $or: [{ fromPath: dest }, { toPath: source }] });
}

async function categories() {
  return Category.find({ deletedAt: null, enabled: { $ne: false } }).select("slug").lean<{ slug: string }[]>();
}

export async function renameCategory(id: string, next: string) {
  await connectDb();
  const paths = await getPaths();
  const parsed = validateSlug(next, paths);
  if (!parsed.ok) throw new Error(parsed.message);
  const row = await Category.findById(id);
  if (!row) throw new Error("Category not found.");
  if (row.slug === parsed.slug) return parsed.slug;
  const taken = await Category.findOne({ slug: parsed.slug, _id: { $ne: row._id } }).select("_id").lean();
  if (taken) throw new Error("That slug is already used.");
  const previous = row.slug;
  row.oldSlugs = [...new Set([...(row.oldSlugs || []).filter((slug) => slug !== parsed.slug), previous])];
  row.slug = parsed.slug;
  await row.save();
  await clearReverseRedirect(`/${previous}/*`, `/${parsed.slug}/*`);
  await saveRedirect(`/${previous}/*`, `/${parsed.slug}/*`);
  notifyIndexNow([`/${parsed.slug}/`]);
  return parsed.slug;
}

export async function renameLocation(id: string, next: string) {
  await connectDb();
  const paths = await getPaths();
  const parsed = validateSlug(next, paths);
  if (!parsed.ok) throw new Error(parsed.message);
  const row = await Location.findById(id);
  if (!row) throw new Error("Place not found.");
  if (row.slug === parsed.slug) return parsed.slug;
  const taken = await Location.findOne({ parentId: row.parentId, type: row.type, slug: parsed.slug, _id: { $ne: row._id } })
    .select("_id")
    .lean();
  if (taken) throw new Error("That slug is already used in this place.");
  const previous = row.slug;
  row.oldSlugs = [...new Set([...(row.oldSlugs || []).filter((slug) => slug !== parsed.slug), previous])];
  row.slug = parsed.slug;
  await row.save();
  const cats = await categories();
  if (row.type === "city" || row.type === "state") {
    for (const cat of cats) {
      await clearReverseRedirect(`/${cat.slug}/${previous}/*`, `/${cat.slug}/${parsed.slug}/*`);
      await saveRedirect(`/${cat.slug}/${previous}/*`, `/${cat.slug}/${parsed.slug}/*`);
    }
  }
  if (row.type === "district" && row.parentId) {
    const city = await Location.findById(row.parentId).select("slug").lean<{ slug?: string }>();
    if (city?.slug) {
      for (const cat of cats) {
        await clearReverseRedirect(`/${cat.slug}/${city.slug}/${previous}/*`, `/${cat.slug}/${city.slug}/${parsed.slug}/*`);
        await saveRedirect(`/${cat.slug}/${city.slug}/${previous}/*`, `/${cat.slug}/${city.slug}/${parsed.slug}/*`);
      }
    }
  }
  notifyIndexNow(cats.map((cat) => `/${cat.slug}/${parsed.slug}/`));
  return parsed.slug;
}

export async function publicTags() {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("tags").lean<{ tags?: { slug?: string; label?: string; replaces?: string }[] }>();
  const custom = Array.isArray(site?.tags) ? site.tags : [];
  const replaced = new Set(custom.map((tag) => tag.replaces).filter((value): value is string => Boolean(value)));
  const tags = new Map<string, string>();
  for (const tag of TAG_PAGES) if (!replaced.has(tag.slug)) tags.set(tag.slug, tag.label);
  for (const tag of custom) if (tag.slug) tags.set(tag.slug, tag.label || tag.slug);
  return [...tags.entries()].map(([slug, label]) => ({ slug, label }));
}

export async function renameTag(previous: string, next: string, label?: string) {
  await connectDb();
  const paths = await getPaths();
  const parsed = validateSlug(next, paths);
  if (!parsed.ok) throw new Error(parsed.message);
  const tags = await publicTags();
  if (!tags.some((tag) => tag.slug === previous)) throw new Error("Tag not found.");
  if (tags.some((tag) => tag.slug === parsed.slug && tag.slug !== previous)) throw new Error("That slug is already used.");
  const site = await Site.findOne({ key: "default" });
  if (!site) throw new Error("Site is missing.");
  const stored = ((site.get("tags") as { slug?: string; label?: string; replaces?: string }[]) || []).filter(
    (tag) => tag.slug && tag.slug !== parsed.slug && tag.slug !== previous,
  );
  const known = TAG_PAGES.find((tag) => tag.slug === previous);
  const earlier = ((site.get("tags") as { slug?: string; label?: string; replaces?: string }[]) || []).find((tag) => tag.slug === previous);
  stored.push({
    slug: parsed.slug,
    label: label || earlier?.label || known?.label || previous,
    replaces: earlier?.replaces || previous,
  });
  site.set("tags", stored);
  site.markModified("tags");
  await site.save();
  await Listing.updateMany({ "attributes.tag": previous }, { $set: { "attributes.tag": parsed.slug } });
  const cats = await categories();
  for (const cat of cats) await saveRedirect(`/${cat.slug}/${paths.tag}/${previous}/*`, `/${cat.slug}/${paths.tag}/${parsed.slug}/*`);
  return parsed.slug;
}

export async function renameContent(kind: "page" | "post", id: string, next: string) {
  await connectDb();
  const paths = await getPaths();
  const parsed = validateSlug(next, paths);
  if (!parsed.ok) throw new Error(parsed.message);
  const prefix = kind === "page" ? paths.cms : paths.blog;
  const row = kind === "page" ? await Page.findById(id) : await BlogPost.findById(id);
  if (!row?.slug) throw new Error("Page not found.");
  if (row.slug === parsed.slug) return parsed.slug;
  const taken = kind === "page"
    ? await Page.findOne({ slug: parsed.slug, _id: { $ne: row._id } }).select("_id").lean()
    : await BlogPost.findOne({ slug: parsed.slug, _id: { $ne: row._id } }).select("_id").lean();
  if (taken) throw new Error("That slug is already used.");
  const previous = row.slug;
  row.slug = parsed.slug;
  await row.save();
  await saveRedirect(`/${prefix}/${previous}/*`, `/${prefix}/${parsed.slug}/*`);
  return parsed.slug;
}

export async function renameAd(id: string, titlePart: string) {
  await connectDb();
  const paths = await getPaths();
  const row = await Listing.findById(id).select("slug");
  if (!row?.slug) throw new Error("Ad not found.");
  const parts = splitAdSlug(row.slug);
  const parsed = validateSlug(titlePart, paths);
  if (!parsed.ok) throw new Error(parsed.message);
  const slug = joinAdSlug(parsed.slug, parts.id);
  if (!slug) throw new Error("Use lowercase letters, numbers, and hyphens.");
  if (slug === row.slug) return slug;
  const taken = await Listing.findOne({ slug, _id: { $ne: row._id } }).select("_id").lean();
  if (taken) throw new Error("That slug is already used.");
  const previous = row.slug;
  await Listing.updateOne({ _id: row._id }, { $set: { slug } });
  await saveRedirect(`/${paths.ad}/${previous}/*`, `/${paths.ad}/${slug}/*`);
  notifyIndexNow([`/${paths.ad}/${slug}/`]);
  return slug;
}

function notifyIndexNow(paths: string[]) {
  void import("@/server/indexnow/ping")
    .then((mod) => mod.queueIndexNow(paths))
    .catch(() => undefined);
}

export async function setPrefixes(input: Partial<Record<PathKey, string>>) {
  await connectDb();
  const site = await Site.findOne({ key: "default" });
  if (!site) throw new Error("Site is missing.");
  const current = readPaths(site.get("paths"));
  const next: UrlPaths = { ...current };
  for (const key of Object.keys(input) as PathKey[]) {
    const value = input[key];
    if (value === undefined) continue;
    const parsed = validatePrefix(value);
    if (!parsed.ok) throw new Error(parsed.message);
    next[key] = parsed.prefix;
  }
  const values = Object.values(next);
  if (new Set(values).size !== values.length) throw new Error("Two prefixes cannot be the same.");
  const cats = await categories();
  for (const value of values) {
    const parts = value.split("/");
    if (cats.some((cat) => cat.slug === value || parts.includes(cat.slug))) throw new Error("A prefix cannot match a category slug.");
  }
  for (const key of Object.keys(next) as PathKey[]) {
    if (next[key] === current[key]) continue;
    if (key === "tag") {
      for (const cat of cats) await saveRedirect(`/${cat.slug}/${current.tag}/*`, `/${cat.slug}/${next.tag}/*`);
      continue;
    }
    await saveRedirect(`/${current[key]}/*`, `/${next[key]}/*`);
  }
  site.set("paths", next);
  site.markModified("paths");
  await site.save();
  await refreshPublic();
  return next;
}

type StoredOverride = {
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

export function overrideFromDoc(doc: StoredOverride): OverrideClean {
  return {
    path: doc.path || "/",
    title: doc.title || "",
    description: doc.description || "",
    h1: doc.h1 || "",
    canonical: doc.canonical || "",
    noindex: doc.noindex === true,
    ogImage: doc.ogImage || "",
    intro: doc.intro || "",
    faq: (doc.faq ?? []).map((item) => ({ q: item.q || "", a: item.a || "" })),
  };
}

function fieldMessages(errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([key, message]) => [key, [message]]));
}

async function writeOverride(value: OverrideClean) {
  await UrlOverride.updateOne(
    { path: value.path },
    { $set: { title: value.title, description: value.description, h1: value.h1, canonical: value.canonical, noindex: value.noindex, ogImage: value.ogImage, intro: value.intro, faq: value.faq } },
    { upsert: true },
  );
}

/** Validates, then saves. Intro and FAQ are kept as they were when the caller does not send them. */
export async function saveUrlOverride(input: OverrideInput) {
  await connectDb();
  const path = cleanPath(input.path || "/");
  const before = await UrlOverride.findOne({ path }).lean<StoredOverride | null>();
  const merged: OverrideInput = {
    ...input,
    intro: input.intro ?? before?.intro,
    faq: input.faq ?? before?.faq,
  };
  const result = normalizeOverride(merged, siteUrl());
  if (!result.ok) throw new ValidationError("Check the highlighted fields", fieldMessages(result.errors));
  await writeOverride(result.value);
  await refreshPublic();
  return { before: before ? overrideFromDoc(before) : null, after: result.value };
}

export async function deleteUrlOverride(path: string) {
  await connectDb();
  const clean = cleanPath(path);
  const before = await UrlOverride.findOne({ path: clean }).lean<StoredOverride | null>();
  await UrlOverride.deleteOne({ path: clean });
  await refreshPublic();
  return { before: before ? overrideFromDoc(before) : null };
}

export interface CsvPreviewRow {
  line: number;
  path: string;
  status: DiffStatus | "error";
  changes: string[];
  errors: string[];
}

export interface CsvPlan {
  rows: CsvPreviewRow[];
  fileErrors: string[];
  /** Cleaned values for every row that passed, ready to write. */
  ready: OverrideClean[];
}

/** Dry run: parses the file and says what an import would do. Writes nothing. */
export async function planOverrideCsv(csv: string): Promise<CsvPlan> {
  const parsed = overrideRowsFromCsv(csv);
  if (parsed.errors.length) return { rows: [], fileErrors: parsed.errors, ready: [] };
  await connectDb();
  const paths = parsed.rows.map((row) => cleanPath(row.input.path || "/"));
  const found = await UrlOverride.find({ path: { $in: paths } }).lean<StoredOverride[]>();
  const byPath = new Map(found.map((doc) => [doc.path as string, overrideFromDoc(doc)]));
  const seen = new Set<string>();
  const rows: CsvPreviewRow[] = [];
  const ready: OverrideClean[] = [];
  for (const row of parsed.rows) {
    const touched = (["title", "description", "h1"] as const).filter((name) => row.input[name] !== undefined) as string[];
    if (row.input.robots !== undefined) touched.push("noindex");
    const path = cleanPath(row.input.path || "/");
    const existing = byPath.get(path) ?? null;
    const base: OverrideInput = existing
      ? { ...existing, ...Object.fromEntries(Object.entries(row.input).filter(([, value]) => value !== undefined)), robots: row.input.robots ?? undefined, noindex: row.input.robots === undefined ? existing.noindex : undefined }
      : row.input;
    const result = normalizeOverride(base, siteUrl());
    if (!result.ok) {
      rows.push({ line: row.line, path, status: "error", changes: [], errors: Object.values(result.errors) });
      continue;
    }
    if (seen.has(result.value.path)) {
      rows.push({ line: row.line, path, status: "error", changes: [], errors: ["This path appears twice in the file"] });
      continue;
    }
    seen.add(result.value.path);
    const diff = diffOverride(existing, result.value, touched);
    rows.push({ line: row.line, path: result.value.path, status: diff.status, changes: diff.changes, errors: [] });
    if (diff.status !== "same") ready.push(result.value);
  }
  return { rows, fileErrors: [], ready };
}

/** All or nothing: refuses to write when any row has an error. */
export async function applyOverrideCsv(csv: string) {
  const plan = await planOverrideCsv(csv);
  if (plan.fileErrors.length) throw new ValidationError(plan.fileErrors[0], { file: plan.fileErrors });
  const bad = plan.rows.filter((row) => row.status === "error");
  if (bad.length) throw new ValidationError(`Fix ${bad.length} row${bad.length === 1 ? "" : "s"} with errors first; nothing was imported`, { file: [`${bad.length} rows have errors`] });
  for (const value of plan.ready) await writeOverride(value);
  if (plan.ready.length) await refreshPublic();
  return { applied: plan.ready.length, unchanged: plan.rows.length - plan.ready.length };
}

export async function getUrlOverride(path: string) {
  await connectDb();
  return UrlOverride.findOne({ path: cleanPath(path) }).lean();
}

export async function listUrlOverrides() {
  await connectDb();
  return UrlOverride.find().sort({ path: 1 }).limit(1000).lean();
}

export async function searchAds(q: string) {
  await connectDb();
  const text = q.trim();
  const filter = text ? { $or: [{ slug: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { title: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
  return Listing.find(filter).select("slug title").sort({ updatedAt: -1 }).limit(20).lean();
}

export async function urlManagerData() {
  await connectDb();
  const [paths, categories, places, tags, pages, posts, redirects, overrides] = await Promise.all([
    getPaths(),
    Category.find({ deletedAt: null }).select("slug name").sort({ name: 1 }).limit(50).lean(),
    Location.find({ type: { $in: ["state", "city", "district"] }, enabled: { $ne: false } }).select("slug name type").sort({ type: 1, name: 1 }).limit(400).lean(),
    publicTags(),
    Page.find().select("slug title").sort({ title: 1 }).limit(80).lean(),
    BlogPost.find().select("slug title").sort({ title: 1 }).limit(80).lean(),
    listRedirects(),
    listUrlOverrides(),
  ]);
  return { paths, categories, places, tags, pages, posts, redirects, overrides };
}
