import { z, type ZodType } from "zod";
import { safeHref } from "@/lib/sanitize";
import type { PageKey } from "@/server/models/layout";

/* ---- field types shared by blocks (docs/claude/ADMIN_PLAN.md section 3) ---- */

const text = (max = 160) => z.string().trim().max(max);
const required = (max = 160) => text(max).min(1, "This field is required");
const slug = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, "Use a slug such as bengaluru");

/** Tags with handlers, scripts, embeds or javascript: links never pass. Output is also run through safeHtml when rendered. */
const DANGEROUS = /<\s*\/?\s*(script|iframe|object|embed|style|link|meta|form|svg|math|base)\b|<[^>]*\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;
export const richText = (max = 2000) =>
  z
    .string()
    .max(max)
    .refine((value) => !DANGEROUS.test(value), "Rich text cannot contain scripts, embeds or event handlers");

export const link = z.object({
  label: required(60),
  href: z
    .string()
    .trim()
    .max(500)
    .refine((value) => safeHref(value) !== "", "Use a full https link or a path that starts with /"),
});

export const image = z.object({
  assetId: required(64),
  src: z
    .string()
    .trim()
    .max(500)
    .refine((value) => safeHref(value) !== "", "Invalid image address"),
  alt: z.string().trim().min(3, "Describe the image in at least 3 characters").max(125, "Alt text can be at most 125 characters"),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
});

const opt = <T extends ZodType>(schema: T) => schema.optional().nullable();

/* ---- block props ---- */

const hero = z.object({
  heading: required(120),
  subheading: text(300).default(""),
  imageDesktop: opt(image),
  imageMobile: opt(image),
  searchPlaceholder: text(80).default(""),
  primaryCta: opt(link),
  secondaryCta: opt(link),
  overlay: z.enum(["none", "light", "dark"]).default("light"),
});

const categoryGrid = z.object({
  title: text(120).default(""),
  intro: text(300).optional(),
  items: z
    .array(z.object({ categorySlug: slug, label: text(60).optional(), image: opt(image), blurb: text(160).optional(), citySlugs: z.array(slug).max(8).optional() }))
    .max(24)
    .default([]),
  columnsDesktop: z.number().int().min(2).max(6).default(3),
  showCounts: z.boolean().default(false),
});

const cityLinks = z.object({
  title: text(120).default(""),
  mode: z.enum(["top", "manual"]).default("top"),
  citySlugs: z.array(slug).max(30).default([]),
  categorySlug: slug.optional(),
  max: z.number().int().min(1).max(60).default(12),
});

const latestAds = z.object({
  title: text(120).default(""),
  source: z.enum(["visitorCity", "fixedCity", "all"]).default("all"),
  citySlug: slug.optional(),
  categorySlug: slug.optional(),
  count: z.number().int().min(4).max(24).default(8),
  layout: z.enum(["grid", "list"]).default("grid"),
  showPhotos: z.boolean().default(true),
});

const featuredAds = z.object({
  title: text(120).default(""),
  listingIds: z.array(z.string().trim().min(1).max(64)).max(24).default([]),
});

const banner = z.object({
  image: opt(image),
  title: text(120).optional(),
  text: text(300).optional(),
  link: opt(link),
  theme: z.enum(["brand", "neutral", "accent"]).default("brand"),
});

const richTextBlock = z.object({ title: text(120).optional(), body: richText(2000).default("") });

const faq = z.object({
  title: text(120).default(""),
  items: z.array(z.object({ q: required(200), a: richText(1000).refine((v) => v.length > 0, "Answer is required") })).max(8).default([]),
});

const steps = z.object({
  title: text(120).default(""),
  items: z.array(z.object({ icon: text(40).default(""), title: required(80), text: text(300).default("") })).max(6).default([]),
});

const trust = z.object({
  items: z.array(z.object({ icon: text(40).default(""), text: required(120) })).max(6).default([]),
});

const seoText = z.object({ title: text(120).optional(), body: richText(4000).default("") });

const listingHeader = z.object({
  h1Template: required(200),
  introTemplate: text(600).default(""),
  showCount: z.boolean().default(true),
  showUpdated: z.boolean().default(true),
});

const FILTER_KEYS = z.string().trim().min(1).max(40);
const filters = z.object({
  enabled: z.array(FILTER_KEYS).max(12).default(["verified", "photos"]),
  showOnMobileAs: z.enum(["sheet", "inline"]).default("inline"),
});

const listingFeed = z.object({
  perPage: z.number().int().min(12).max(48).default(24),
  cardFields: z.array(z.enum(["photo", "price", "location", "date", "attributes", "badges"])).max(6).default(["photo", "location", "badges"]),
  inFeedBlockId: z.string().trim().max(80).optional(),
  inFeedEvery: z.number().int().min(4).max(30).optional(),
  emptyTitle: required(120),
  emptyText: text(300).default(""),
});

const linkList = z.object({ title: text(120).default(""), max: z.number().int().min(1).max(30).default(10) });

const postIntro = z.object({ title: required(120), text: text(500).default(""), image: opt(image) });

export const POST_STEP_KEYS = ["basics", "details", "photos", "contact", "review", "promote"] as const;
const postStep = z.object({
  stepKey: z.enum(POST_STEP_KEYS),
  title: required(80),
  help: text(300).default(""),
  nextLabel: text(40).default(""),
  backLabel: text(40).default(""),
});

const photoRules = z.object({ title: text(120).default(""), items: z.array(required(200)).max(10).default([]) });

const promotionPicker = z.object({
  title: text(120).default(""),
  products: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  defaultCode: z.string().trim().max(40).optional(),
  note: text(300).default(""),
});

const postSuccess = z.object({ title: required(120), text: text(500).default(""), primaryCta: opt(link), secondaryCta: opt(link) });

/* ---- registry ---- */

export interface BlockDef {
  pages: PageKey[];
  schema: ZodType;
  defaults: () => Record<string, unknown>;
  deletable: boolean;
  /** Most blocks of this type allowed on one page. */
  max?: number;
}

const ALL: PageKey[] = ["home", "listing", "post"];

export const BLOCKS = {
  hero: { pages: ["home"], schema: hero, defaults: () => ({ heading: "Find what you need" }), deletable: true, max: 1 },
  categoryGrid: { pages: ["home", "listing"], schema: categoryGrid, defaults: () => ({ title: "Browse categories" }), deletable: true },
  cityLinks: { pages: ["home", "listing"], schema: cityLinks, defaults: () => ({ title: "Browse by city" }), deletable: true },
  latestAds: { pages: ["home"], schema: latestAds, defaults: () => ({ title: "Latest ads" }), deletable: true },
  featuredAds: { pages: ["home", "listing"], schema: featuredAds, defaults: () => ({ title: "Featured" }), deletable: true },
  banner: { pages: ALL, schema: banner, defaults: () => ({ title: "" }), deletable: true },
  richText: { pages: ALL, schema: richTextBlock, defaults: () => ({ title: "", body: "" }), deletable: true },
  faq: { pages: ["home", "listing"], schema: faq, defaults: () => ({ title: "Questions" }), deletable: true },
  steps: { pages: ["home", "post"], schema: steps, defaults: () => ({ title: "How it works" }), deletable: true },
  trust: { pages: ALL, schema: trust, defaults: () => ({}), deletable: true },
  seoText: { pages: ["home", "listing"], schema: seoText, defaults: () => ({ body: "" }), deletable: true },
  listingHeader: {
    pages: ["listing"],
    schema: listingHeader,
    defaults: () => ({ h1Template: "{category} in {city}", introTemplate: "" }),
    deletable: false,
    max: 1,
  },
  filters: { pages: ["listing"], schema: filters, defaults: () => ({}), deletable: true, max: 1 },
  listingFeed: {
    pages: ["listing"],
    schema: listingFeed,
    defaults: () => ({ emptyTitle: "No ads here yet", emptyText: "Check back soon." }),
    deletable: false,
    max: 1,
  },
  districtLinks: { pages: ["listing"], schema: linkList, defaults: () => ({ title: "Areas" }), deletable: true },
  nearbyCities: { pages: ["listing"], schema: linkList, defaults: () => ({ title: "Nearby cities" }), deletable: true },
  relatedCategories: { pages: ["listing"], schema: linkList, defaults: () => ({ title: "Related categories" }), deletable: true },
  postIntro: { pages: ["post"], schema: postIntro, defaults: () => ({ title: "Post an ad" }), deletable: true, max: 1 },
  postStep: { pages: ["post"], schema: postStep, defaults: () => ({ stepKey: "basics", title: "Basics" }), deletable: false, max: 6 },
  photoRules: { pages: ["post"], schema: photoRules, defaults: () => ({ title: "Photo rules" }), deletable: true, max: 1 },
  promotionPicker: { pages: ["post"], schema: promotionPicker, defaults: () => ({ title: "Promote your ad" }), deletable: true, max: 1 },
  postSuccess: { pages: ["post"], schema: postSuccess, defaults: () => ({ title: "Your ad is live" }), deletable: true, max: 1 },
} satisfies Record<string, BlockDef>;

export type BlockType = keyof typeof BLOCKS;
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(BLOCKS, value);
}

export function blockDef(type: string): BlockDef | null {
  return isBlockType(type) ? (BLOCKS[type] as BlockDef) : null;
}

/** Block types an editor may add to a page. */
export function typesForPage(page: PageKey): BlockType[] {
  return BLOCK_TYPES.filter((type) => (BLOCKS[type] as BlockDef).pages.includes(page));
}

/** Common fields of every block, checked before the type's own props. */
export const blockEnvelope = z.object({
  id: z.string().trim().max(80).optional(),
  type: z.string().trim().min(1).max(40),
  visible: z.boolean(),
  label: text(60).optional(),
  devices: z.array(z.enum(["mobile", "desktop"])).max(2).optional(),
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  props: z.record(z.string(), z.unknown()),
});

export type BlockEnvelope = z.infer<typeof blockEnvelope>;
