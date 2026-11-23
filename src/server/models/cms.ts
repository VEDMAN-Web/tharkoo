import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

interface BaseDoc {
  _id?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SeoTemplateDoc extends BaseDoc {
  pageType?: string;
  title?: string;
  description?: string;
  h1?: string;
  h2?: string;
  intro?: string;
  footer?: string;
}

export interface SiteDoc extends BaseDoc {
  key?: string;
  postingFeeCredits?: number;
  creditPriceInr?: number;
  mockPaymentsOn?: boolean;
  paidPostingOn?: boolean;
  /** H11.1: how many of an account's first ads are free when Paid posting is on. */
  freeAdsPerAccount?: number;
  planOrder?: string[];
  name?: string;
  tagline?: string;
  legalName?: string;
  countryName?: string;
  supportHours?: string;
  supportWhatsapp?: string;
  supportTelegram?: string;
  /** H17.11: the Google Analytics measurement ID (G-XXXXXXXXXX). Empty or missing means no tag. Set in Admin > Settings. */
  googleAnalyticsId?: string;
  ageGateEnabled?: boolean;
  ageGateTitle?: string;
  ageGateBody?: string;
  ageYes?: string;
  ageNo?: string;
  cookieBody?: string;
  cookieAccept?: string;
  cookieNecessary?: string;
  searchPlaceholder?: string;
  postCta?: string;
  logoText?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  theme?: unknown;
  footerLinks?: unknown;
  socialLinks?: unknown;
  homepage?: unknown;
  landings?: unknown;
  tags?: { slug?: string; label?: string; replaces?: string }[];
  freeAdsPerWeek?: number;
  /** How long an ad stays live before it is gone (410). Not read since H7.158: the lifetime is the code constant (48 hours). */
  adLifetimeHours?: number;
  paths?: unknown;
  /** Indexing rules (H4.6): thresholds, switched-off categories and cities. */
  seoIndexing?: unknown;
  /** robots extras, llms.txt text, Organization fields, ad schema mapping, default OG image (H4.7). */
  seoSettings?: unknown;
  /** Listing order settings (H3.8). Missing means the original order. */
  ranking?: { tierOrder?: string[]; verifiedFirst?: boolean; photoFirst?: boolean };
  /** Require an approved ID check before posting (H6.14). Missing means off. */
  requireIdCheckToPost?: boolean;
  /** Listing card width on category and city pages (H6.17): narrow 760, medium 880 (default), full. Missing means medium. */
  listingCardWidth?: "narrow" | "medium" | "full";
  /** Emergency switches. Every switch is off unless an admin turns it on. */
  emergency?: {
    holdNewAds?: boolean;
    pauseNewAccounts24h?: boolean;
    pausePurchases?: boolean;
    pauseVideoCalls?: boolean;
    pausePaidPosting?: boolean;
  };
  /** How many days each kind of change can be undone. */
  undoWindows?: { edits?: number; decisions?: number; credits?: number; demo?: number; settings?: number };
  /** Ads published after this date show in "Live, not checked". Missing means none do. */
  postModerationSince?: Date | null;
  /** True: the home page is drawn from the page builder layout (format 2). Missing means false. */
  homeFromLayout?: boolean;
  /** Where listing page headings and intros come from. Missing means "legacy". */
  listingCopySource?: "legacy" | "content";
  /** Manual ticks on the launch checklist: who ticked and when. */
  launchChecklist?: { junkAdsChecked?: LaunchTick | null; bannerChecked?: LaunchTick | null; paidPostingDecided?: LaunchTick | null };
}

export interface LaunchTick {
  at: Date;
  by: string;
}

export interface PageDoc extends BaseDoc {
  slug?: string;
  title?: string;
  body?: string;
  status?: string;
}

export interface HelpArticleDoc extends BaseDoc {
  slug?: string;
  title?: string;
  body?: string;
  section?: string;
  order?: number;
  status?: string;
}

export interface BlogPostDoc extends BaseDoc {
  slug?: string;
  title?: string;
  body?: string;
  date?: string;
  author?: string;
  category?: string;
  cover?: string;
  coverAlt?: string;
  coverFocus?: string;
  status?: string;
}

export interface CreditPackDoc extends BaseDoc {
  credits?: number;
  price?: number;
  bonus?: number;
  tag?: string;
  order?: number;
  status?: string;
  /** H18.8: "call" packs fill call credits, everything else fills ad credits. */
  wallet?: string;
}

export interface BannerDoc extends BaseDoc {
  slot?: string;
  title?: string;
  body?: string;
  href?: string;
  cta?: string;
  enabled?: boolean;
  order?: number;
}

export interface CouponDoc extends BaseDoc {
  code?: string;
  label?: string;
  value?: string;
  expiry?: string;
  status?: string;
  kind?: "percent" | "credits" | "label";
  percent?: number | null;
  credits?: number | null;
  maxRedemptions?: number | null;
  perUserLimit?: number | null;
  redeemedCount?: number;
  expiresAt?: Date | null;
  startsAt?: Date | null;
}

export interface BannedWordDoc extends BaseDoc {
  text?: string;
  matchType?: string;
  scope?: string;
  action?: string;
}

export interface FeatureFlagDoc extends BaseDoc {
  key?: string;
  label?: string;
  enabled?: boolean;
}

export interface AttributeGroupDoc extends BaseDoc {
  key?: string;
  label?: string;
  type?: string;
  options?: string[];
  order?: number;
}

export interface ProductDoc extends BaseDoc {
  name?: string;
  slug?: string;
  benefits?: string;
  credits?: number;
  status?: string;
}

const seoTemplateSchema = new Schema<SeoTemplateDoc>(
  {
    pageType: { type: String, unique: true },
    title: String,
    description: String,
    h1: String,
    h2: String,
    intro: String,
    footer: String,
  },
  { collection: collectionName("seo_templates", "SeoTemplate") },
);

const siteSchema = new Schema<SiteDoc>(
  {
    key: { type: String, unique: true },
    name: String,
    tagline: String,
    legalName: String,
    countryName: String,
    supportHours: String,
    supportWhatsapp: String,
    supportTelegram: String,
    googleAnalyticsId: { type: String },
    ageGateEnabled: { type: Boolean, default: true },
    ageGateTitle: String,
    ageGateBody: String,
    ageYes: String,
    ageNo: String,
    cookieBody: String,
    cookieAccept: String,
    cookieNecessary: String,
    searchPlaceholder: String,
    postCta: String,
    logoText: String,
    logoUrl: String,
    logoDarkUrl: String,
    theme: Schema.Types.Mixed,
    footerLinks: Schema.Types.Mixed,
    socialLinks: Schema.Types.Mixed,
    homepage: Schema.Types.Mixed,
    landings: Schema.Types.Mixed,
    tags: { type: [{ slug: String, label: String, replaces: String }], default: [] },
    freeAdsPerWeek: { type: Number },
    adLifetimeHours: { type: Number },
    paths: Schema.Types.Mixed,
    seoIndexing: Schema.Types.Mixed,
    seoSettings: Schema.Types.Mixed,
    ranking: {
      type: new Schema({ tierOrder: [String], verifiedFirst: Boolean, photoFirst: Boolean }, { _id: false }),
    },
    requireIdCheckToPost: { type: Boolean },
    listingCardWidth: { type: String, enum: ["narrow", "medium", "full"] },
    emergency: {
      type: new Schema(
        {
          holdNewAds: { type: Boolean, default: false },
          pauseNewAccounts24h: { type: Boolean, default: false },
          pausePurchases: { type: Boolean, default: false },
          pauseVideoCalls: { type: Boolean, default: false },
          pausePaidPosting: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    undoWindows: {
      type: new Schema(
        {
          edits: { type: Number, default: 30, min: 1, max: 365 },
          decisions: { type: Number, default: 7, min: 1, max: 365 },
          credits: { type: Number, default: 7, min: 1, max: 365 },
          demo: { type: Number, default: 7, min: 1, max: 365 },
          settings: { type: Number, default: 30, min: 1, max: 365 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
    postModerationSince: { type: Date, default: null },
    homeFromLayout: { type: Boolean, default: false },
    // H8.17: money settings and the order of promotion plans live on the site record, so one undo restores them.
    postingFeeCredits: { type: Number, min: 0 },
    creditPriceInr: { type: Number, min: 1 },
    mockPaymentsOn: { type: Boolean },
    paidPostingOn: { type: Boolean },
    freeAdsPerAccount: { type: Number, min: 0 },
    planOrder: { type: [String], default: undefined },
    listingCopySource: { type: String, enum: ["legacy", "content"], default: "legacy" },
    launchChecklist: {
      type: new Schema(
        {
          junkAdsChecked: { type: new Schema({ at: Date, by: String }, { _id: false }), default: null },
          bannerChecked: { type: new Schema({ at: Date, by: String }, { _id: false }), default: null },
          paidPostingDecided: { type: new Schema({ at: Date, by: String }, { _id: false }), default: null },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true, collection: collectionName("sites", "Site") },
);

const pageSchema = new Schema<PageDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    status: { type: String, default: "published" },
  },
  { timestamps: true, collection: collectionName("pages", "Page") },
);

const helpArticleSchema = new Schema<HelpArticleDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    section: String,
    order: Number,
    status: { type: String, default: "published" },
  },
  { timestamps: true, collection: collectionName("help_articles", "HelpArticle") },
);

const blogPostSchema = new Schema<BlogPostDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    date: String,
    author: String,
    category: String,
    cover: String,
    coverAlt: String,
    coverFocus: String,
    status: { type: String, default: "published" },
  },
  { timestamps: true, collection: collectionName("blog_posts", "BlogPost") },
);

const creditPackSchema = new Schema<CreditPackDoc>(
  {
    credits: Number,
    price: Number,
    bonus: Number,
    tag: String,
    order: Number,
    status: { type: String, default: "active" },
    wallet: { type: String, enum: ["ad", "call"], default: "ad" },
  },
  { collection: collectionName("credit_packs", "CreditPack") },
);

const bannerSchema = new Schema<BannerDoc>(
  {
    slot: String,
    title: String,
    body: String,
    href: String,
    cta: String,
    enabled: { type: Boolean, default: true },
    order: Number,
  },
  { collection: collectionName("banners", "Banner") },
);

const couponSchema = new Schema<CouponDoc>(
  {
    code: { type: String, index: true, unique: true, sparse: true },
    label: String,
    value: String,
    expiry: String,
    status: { type: String, default: "active" },
    kind: { type: String, enum: ["percent", "credits", "label"], default: "label" },
    percent: { type: Number, default: null },
    credits: { type: Number, default: null },
    maxRedemptions: { type: Number, default: null },
    perUserLimit: { type: Number, default: null },
    redeemedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },
    startsAt: { type: Date, default: null },
  },
  { timestamps: true, collection: collectionName("coupons", "Coupon") },
);

const bannedWordSchema = new Schema<BannedWordDoc>(
  {
    text: String,
    matchType: String,
    scope: String,
    action: String,
  },
  { collection: collectionName("banned_words", "BannedWord") },
);

const featureFlagSchema = new Schema<FeatureFlagDoc>(
  {
    key: { type: String, unique: true },
    label: String,
    enabled: { type: Boolean, default: true },
  },
  { collection: collectionName("feature_flags", "FeatureFlag") },
);

const attributeGroupSchema = new Schema<AttributeGroupDoc>(
  {
    key: String,
    label: String,
    type: String,
    options: [String],
    order: Number,
  },
  { collection: collectionName("attribute_groups", "AttributeGroup") },
);

const productSchema = new Schema<ProductDoc>(
  {
    name: String,
    slug: String,
    benefits: String,
    credits: Number,
    status: { type: String, default: "active" },
  },
  { collection: collectionName("products", "Product") },
);

export const SeoTemplate = registerModel<SeoTemplateDoc>(modelName("SeoTemplate"), seoTemplateSchema);
export const Site = registerModel<SiteDoc>(modelName("Site"), siteSchema);
export const Page = registerModel<PageDoc>(modelName("Page"), pageSchema);
export const HelpArticle = registerModel<HelpArticleDoc>(modelName("HelpArticle"), helpArticleSchema);
export const BlogPost = registerModel<BlogPostDoc>(modelName("BlogPost"), blogPostSchema);
export const CreditPack = registerModel<CreditPackDoc>(modelName("CreditPack"), creditPackSchema);
export const Banner = registerModel<BannerDoc>(modelName("Banner"), bannerSchema);
export const Coupon = registerModel<CouponDoc>(modelName("Coupon"), couponSchema);
export const BannedWord = registerModel<BannedWordDoc>(modelName("BannedWord"), bannedWordSchema);
export const FeatureFlag = registerModel<FeatureFlagDoc>(modelName("FeatureFlag"), featureFlagSchema);
export const AttributeGroup = registerModel<AttributeGroupDoc>(
  modelName("AttributeGroup"),
  attributeGroupSchema,
);
export const Product = registerModel<ProductDoc>(modelName("Product"), productSchema);

export interface RedirectDoc extends BaseDoc {
  fromPath: string;
  toPath: string;
  hits?: number;
  enabled?: boolean;
}

export interface UrlOverrideDoc extends BaseDoc {
  path: string;
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
  intro?: string;
  faq?: { q: string; a: string }[];
}

const redirectSchema = new Schema<RedirectDoc>(
  {
    fromPath: { type: String, required: true, unique: true },
    toPath: { type: String, required: true },
    hits: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: collectionName("redirects", "Redirect") },
);

const urlOverrideSchema = new Schema<UrlOverrideDoc>(
  {
    path: { type: String, required: true, unique: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    h1: { type: String, default: "" },
    canonical: { type: String, default: "" },
    noindex: { type: Boolean, default: false },
    ogImage: { type: String, default: "" },
    intro: { type: String, default: "" },
    faq: { type: [{ _id: false, q: String, a: String }], default: [] },
  },
  { timestamps: true, collection: collectionName("url_overrides", "UrlOverride") },
);

export const Redirect = registerModel<RedirectDoc>(modelName("Redirect"), redirectSchema);
export const UrlOverride = registerModel<UrlOverrideDoc>(modelName("UrlOverride"), urlOverrideSchema);
