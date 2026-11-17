import { connectDb } from "@/lib/db";
import { listingHeading, listingScopes } from "@/lib/layout/listing";
import { getPageBlocks } from "@/lib/layout/read";
import { getSeoFor, getSite } from "@/lib/queries";
import { fillTemplate, type SeoVars } from "@/lib/seo";
import { fallbackLanding, type LandingCopy } from "@/lib/seo/landing";
import { cleanPath } from "@/lib/urls";
import { listingDefaultBlocks } from "@/server/layout/defaults/listing";
import { ContentItem } from "@/server/models";
import { getUrlOverride } from "@/server/urls/service";

/** Where a piece of listing page copy comes from. The first six are the sources of H8.29; "content" is the new editor, the others are today's. */
export type CopySource = "content" | "url-override" | "site-landing" | "listing-header" | "seo-template" | "code";
export type CopyField = "h1" | "intro" | "faqs" | "title" | "description";
type Faq = { q: string; a: string };

export interface ListingCopyInput {
  /** "category": /dating/. "place": /dating/pune/ (a city or a state). */
  kind: "category" | "place";
  path: string;
  categorySlug: string;
  category: string;
  /** Name of the city or state, for a place page. */
  place?: string;
  state?: string;
  count: number;
  indexable?: boolean;
  districts?: string[];
  updated?: string;
  /** Overrides `Site.listingCopySource` ("legacy" is today's order, "content" puts the content editor first). */
  mode?: "legacy" | "content";
}

export interface ListingCopy {
  h1: string;
  intro: string;
  faqs: Faq[];
  title: string;
  description: string;
  /** The source that won each field. */
  sources: Record<CopyField, CopySource>;
  /** The source of the intro, the main text of the page. */
  source: CopySource;
}

export interface ListingCopyExplained extends ListingCopy {
  mode: "legacy" | "content";
  /** Every source that has text for the field, the winner first. */
  candidates: Record<CopyField, { source: CopySource; text: string }[]>;
}

type Tier<T> = { source: CopySource; value: T | undefined };
type Tiers = { [F in CopyField]: Tier<F extends "faqs" ? Faq[] : string>[] };

const CATEGORY_TITLE = "{category} classifieds across India | Tharkoo";
const CATEGORY_DESCRIPTION = "Browse {category} on Tharkoo: listings from people across Indian cities. Filter by city and district, see photos and contact posters directly.";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const present = (tier: Tier<unknown>) => (Array.isArray(tier.value) ? tier.value.length > 0 : typeof tier.value === "string" ? tier.value !== "" : tier.value !== undefined);
const textOf = (value: string | Faq[]) => (typeof value === "string" ? value : value.map((item) => `${item.q} ${item.a}`).join(" | "));

function cleanFaqs(items: { q?: string; a?: string }[] | null | undefined, limit?: number): Faq[] {
  const rows = (items ?? []).filter((item) => item?.q && item?.a).map((item) => ({ q: item.q as string, a: item.a as string }));
  return limit ? rows.slice(0, limit) : rows;
}

type Published = { h1?: string; intro?: string; faqs?: Faq[]; title?: string; description?: string };

async function publishedContent(path: string): Promise<Published | null> {
  const item = await ContentItem.findOne({ kind: "listingIntro", path, status: "published" }).lean<{ published?: { h1?: string; body?: unknown; faq?: { q?: string; a?: string }[]; seo?: { title?: string; description?: string } } | null } | null>();
  const fields = item?.published;
  if (!fields) return null;
  return {
    h1: text(fields.h1),
    intro: typeof fields.body === "string" ? fields.body.trim() : "",
    faqs: cleanFaqs((fields.faq ?? []).map((row) => ({ q: text(row?.q), a: text(row?.a) }))),
    title: text(fields.seo?.title),
    description: text(fields.seo?.description),
  };
}

async function headerBlock(path: string, categorySlug: string) {
  const published = await getPageBlocks("listing", listingScopes(path, categorySlug)).catch(() => null);
  const blocks = published ?? listingDefaultBlocks();
  const found = blocks.find((block) => block.type === "listingHeader") ?? listingDefaultBlocks().find((block) => block.type === "listingHeader");
  return { h1Template: String(found?.props.h1Template ?? ""), introTemplate: String(found?.props.introTemplate ?? "") };
}

async function gather(input: ListingCopyInput): Promise<{ tiers: Tiers; mode: "legacy" | "content"; h1Template: string; vars: SeoVars }> {
  await connectDb();
  const path = cleanPath(input.path);
  const [site, seo, over, content, header] = await Promise.all([
    getSite() as Promise<{ name?: string; landings?: Record<string, Partial<LandingCopy>>; listingCopySource?: string }>,
    getSeoFor(input.kind === "category" ? "category" : "location", input.categorySlug),
    getUrlOverride(path),
    publishedContent(path),
    headerBlock(path, input.categorySlug),
  ]);
  const mode = input.mode ?? (site.listingCopySource === "content" ? "content" : "legacy");
  const place = input.kind === "place";
  const vars: SeoVars = {
    category: input.category,
    ...(place ? { city: input.place, state: input.state ?? input.place, count: input.count } : {}),
    site: site.name,
    year: new Date().getFullYear(),
    ...(place ? { districtPref: "" } : {}),
  } as SeoVars;
  const fallback = fallbackLanding(
    place
      ? { category: input.category, city: input.place, count: input.count, indexable: input.indexable, districts: input.districts, updated: input.updated, site: site.name }
      : { category: input.category, count: input.count, site: site.name },
  );
  const landingKey = place ? `${input.category.toLowerCase()}|${(input.place ?? "").toLowerCase()}` : `${input.categorySlug}|india`;
  const landing = site.landings?.[landingKey];
  const landingFaqs = cleanFaqs(landing?.faqs?.map((row) => ({ q: row.q?.trim(), a: row.a?.trim() })));
  const urlFaqs = cleanFaqs(over?.faq, 8);
  const codeH1 = place ? fallback.h1 : `${input.category} in India`;

  if (mode === "content") {
    const seoTitle = seo?.title ? fillTemplate(seo.title, vars) : undefined;
    const seoDescription = seo?.description ? fillTemplate(seo.description, vars) : undefined;
    const introTemplate = header.introTemplate.trim() && header.introTemplate !== "{h1}" ? fillTemplate(header.introTemplate, vars).replace(/\s+/g, " ").trim() : undefined;
    return {
      mode,
      vars,
      h1Template: header.h1Template,
      tiers: {
        h1: [{ source: "content", value: content?.h1 }, { source: "code", value: codeH1 }],
        intro: [{ source: "content", value: content?.intro }, { source: "listing-header", value: introTemplate }, { source: "code", value: fallback.intro }],
        faqs: [{ source: "content", value: content?.faqs }, { source: "code", value: fallback.faqs }],
        title: [{ source: "content", value: content?.title }, { source: "seo-template", value: seoTitle }, { source: "code", value: fillTemplate(place ? fallback.title : CATEGORY_TITLE, vars) }],
        description: [{ source: "content", value: content?.description }, { source: "seo-template", value: seoDescription }, { source: "code", value: fillTemplate(place ? fallback.description : CATEGORY_DESCRIPTION, vars) }],
      },
    };
  }

  const seoH1 = seo?.h1 ? fillTemplate(seo.h1, vars) : "";
  return {
    mode,
    vars,
    h1Template: place ? "" : header.h1Template,
    tiers: {
      h1: place
        ? [
            { source: "url-override", value: text(over?.h1) },
            { source: "seo-template", value: seoH1 && /\bin\b/i.test(seoH1) ? seoH1 : undefined },
            { source: "site-landing", value: text(landing?.h1) },
            { source: "code", value: codeH1 },
          ]
        : [{ source: "url-override", value: text(over?.h1) }, { source: "code", value: codeH1 }],
      intro: [
        { source: "url-override", value: text(over?.intro) },
        { source: "site-landing", value: text(landing?.intro) },
        { source: "code", value: fallback.intro },
        { source: "seo-template", value: seo?.intro ? fillTemplate(seo.intro, vars) : undefined },
      ],
      faqs: [{ source: "url-override", value: urlFaqs }, { source: "site-landing", value: landingFaqs }, { source: "code", value: fallback.faqs }],
      title: [
        { source: "url-override", value: text(over?.title) },
        { source: "seo-template", value: seo?.title ? fillTemplate(seo.title, vars) : undefined },
        ...(place ? [{ source: "site-landing" as const, value: text(landing?.title) ? fillTemplate(text(landing?.title), vars) : undefined }, { source: "code" as const, value: fillTemplate(fallback.title, vars) }] : [{ source: "code" as const, value: fillTemplate(CATEGORY_TITLE, vars) }]),
      ],
      description: [
        { source: "url-override", value: text(over?.description) },
        { source: "seo-template", value: seo?.description ? fillTemplate(seo.description, vars) : undefined },
        ...(place
          ? [{ source: "site-landing" as const, value: text(landing?.description) ? fillTemplate(text(landing?.description), vars) : undefined }, { source: "code" as const, value: fillTemplate(fallback.description, vars) }]
          : [{ source: "code" as const, value: fillTemplate(CATEGORY_DESCRIPTION, vars) }]),
      ],
    },
  };
}

function pick<T extends string | Faq[]>(tiers: Tier<T>[]): { source: CopySource; value: T } {
  const winner = tiers.find(present);
  return winner ? { source: winner.source, value: winner.value as T } : { source: "code", value: (typeof tiers[0]?.value === "string" ? "" : []) as T };
}

/** `{h1}` stays the heading the page already worked out; a different template wraps it (category pages only, as today). */
function withHeader(winner: { source: CopySource; value: string }, template: string, vars: SeoVars, count: number): { source: CopySource; value: string } {
  if (!template.trim() || template.trim() === "{h1}") return winner;
  const filled = listingHeading(template, winner.value, { ...vars, count, h1: winner.value } as Record<string, string | number | undefined>);
  return filled === winner.value ? winner : { source: "listing-header", value: filled };
}

/**
 * The copy of a listing page and where each part came from (H8.29). It changes nothing on the site yet: the pages still read their own sources.
 * In "legacy" mode it gives the same words the pages give today; in "content" mode the content editor's listing text comes first.
 */
export async function resolveListingCopy(input: ListingCopyInput): Promise<ListingCopy> {
  await connectDb();
  const { tiers, h1Template, vars } = await gather(input);
  const h1 = withHeader(pick(tiers.h1), h1Template, vars, input.count);
  const intro = pick(tiers.intro);
  const faqs = pick(tiers.faqs);
  const title = pick(tiers.title);
  const description = pick(tiers.description);
  return {
    h1: h1.value,
    intro: intro.value,
    faqs: faqs.value,
    title: title.value,
    description: description.value,
    sources: { h1: h1.source, intro: intro.source, faqs: faqs.source, title: title.source, description: description.source },
    source: intro.source,
  };
}

/** "Which text is used on this URL?": the resolved copy plus every source that has text for each field. */
export async function explain(input: ListingCopyInput): Promise<ListingCopyExplained> {
  await connectDb();
  const copy = await resolveListingCopy(input);
  const { tiers, mode } = await gather(input);
  const list = (field: CopyField) =>
    (tiers[field] as Tier<string | Faq[]>[]).filter(present).map((tier) => ({ source: tier.source, text: textOf(tier.value as string | Faq[]) }));
  return { ...copy, mode, candidates: { h1: list("h1"), intro: list("intro"), faqs: list("faqs"), title: list("title"), description: list("description") } };
}
