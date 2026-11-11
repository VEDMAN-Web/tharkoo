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
  name?: string;
  tagline?: string;
  legalName?: string;
  countryName?: string;
  supportHours?: string;
  supportWhatsapp?: string;
  supportTelegram?: string;
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
  theme?: unknown;
  footerLinks?: unknown;
  socialLinks?: unknown;
  homepage?: unknown;
  landings?: unknown;
  tags?: { slug?: string; label?: string; replaces?: string }[];
  freeAdsPerWeek?: number;
  paths?: unknown;
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
  status?: string;
}

export interface CreditPackDoc extends BaseDoc {
  credits?: number;
  price?: number;
  bonus?: number;
  tag?: string;
  order?: number;
  status?: string;
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
    theme: Schema.Types.Mixed,
    footerLinks: Schema.Types.Mixed,
    socialLinks: Schema.Types.Mixed,
    homepage: Schema.Types.Mixed,
    landings: Schema.Types.Mixed,
    tags: { type: [{ slug: String, label: String, replaces: String }], default: [] },
    freeAdsPerWeek: { type: Number },
    paths: Schema.Types.Mixed,
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
  },
  { timestamps: true, collection: collectionName("url_overrides", "UrlOverride") },
);

export const Redirect = registerModel<RedirectDoc>(modelName("Redirect"), redirectSchema);
export const UrlOverride = registerModel<UrlOverrideDoc>(modelName("UrlOverride"), urlOverrideSchema);
