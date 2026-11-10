import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema<CategoryDoc>(
  {
    name: String,
    slug: { type: String, unique: true },
    description: String,
    icon: String,
    color: String,
    order: Number,
    starEnabled: { type: Boolean, default: false },
    status: { type: String, default: "active" },
    showOnHome: { type: Boolean, default: true },
    homeBlurb: String,
    homeCities: [String],
    moreLabel: { type: String, default: "More cities" },
  },
  { timestamps: true },
);

const LocationSchema = new Schema<LocationDoc>(
  {
    kind: { type: String, enum: ["country", "state", "city", "district"] },
    name: String,
    slug: String,
    parentSlug: String,
    stateSlug: String,
    citySlug: String,
    status: { type: String, default: "active" },
    isTop: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 999 },
    lat: Number,
    lng: Number,
    seoH1: String,
    seoIntro: String,
  },
  { timestamps: true },
);
LocationSchema.index({ kind: 1, slug: 1 }, { unique: true });

const ListingSchema = new Schema<ListingDoc>(
  {
    publicId: { type: String, unique: true },
    slug: String,
    title: String,
    description: String,
    displayName: String,
    age: Number,
    categorySlug: String,
    stateSlug: String,
    citySlug: String,
    districtSlug: String,
    place: String,
    chips: [String],
    photos: [String],
    photoCountVisible: { type: Number, default: 1 },
    variant: {
      type: String,
      enum: ["free", "top", "supertop", "highlight", "flash", "star"],
      default: "free",
    },
    verified: { type: Boolean, default: false },
    subscriber: { type: Boolean, default: false },
    lastBumpedAt: Date,
    publishedAt: Date,
    status: { type: String, default: "live" },
    phone: String,
    whatsapp: String,
    telegram: String,
    emailOn: { type: Boolean, default: false },
    tags: Schema.Types.Mixed,
  },
  { timestamps: true },
);
ListingSchema.index({ categorySlug: 1, citySlug: 1, lastBumpedAt: -1 });

const SeoTemplateSchema = new Schema<SeoTemplateDoc>({
  pageType: { type: String, unique: true },
  title: String,
  description: String,
  h1: String,
  h2: String,
  intro: String,
  footer: String,
});

const SiteSchema = new Schema<SiteDoc>(
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
  },
  { timestamps: true },
);

const PageSchema = new Schema<PageDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    status: { type: String, default: "published" },
  },
  { timestamps: true },
);

const HelpArticleSchema = new Schema<HelpArticleDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    section: String,
    order: Number,
    status: { type: String, default: "published" },
  },
  { timestamps: true },
);

const BlogPostSchema = new Schema<BlogPostDoc>(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    date: String,
    author: String,
    status: { type: String, default: "published" },
  },
  { timestamps: true },
);

const CreditPackSchema = new Schema<CreditPackDoc>({
  credits: Number,
  price: Number,
  bonus: Number,
  tag: String,
  order: Number,
  status: { type: String, default: "active" },
});

const BannerSchema = new Schema<BannerDoc>({
  slot: String,
  title: String,
  body: String,
  href: String,
  cta: String,
  enabled: { type: Boolean, default: true },
  order: Number,
});

const CouponSchema = new Schema<CouponDoc>({
  code: String,
  label: String,
  value: String,
  expiry: String,
  status: { type: String, default: "active" },
});

const BannedWordSchema = new Schema<BannedWordDoc>({
  text: String,
  matchType: String,
  scope: String,
  action: String,
});

const FeatureFlagSchema = new Schema<FeatureFlagDoc>({
  key: { type: String, unique: true },
  label: String,
  enabled: { type: Boolean, default: true },
});

const AttributeGroupSchema = new Schema<AttributeGroupDoc>({
  key: String,
  label: String,
  type: String,
  options: [String],
  order: Number,
});

const ProductSchema = new Schema<ProductDoc>({
  name: String,
  slug: String,
  benefits: String,
  credits: Number,
  status: { type: String, default: "active" },
});

function model<T>(name: string, schema: Schema<T>) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}

interface BaseDoc {
  _id?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CategoryDoc extends BaseDoc {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  starEnabled: boolean;
  status: string;
  showOnHome: boolean;
  homeBlurb: string;
  homeCities: string[];
  moreLabel: string;
}

export interface LocationDoc extends BaseDoc {
  kind: "country" | "state" | "city" | "district";
  name: string;
  slug: string;
  parentSlug: string;
  stateSlug: string;
  citySlug: string;
  status: string;
  isTop: boolean;
  sortOrder: number;
  lat: number;
  lng: number;
  seoH1: string;
  seoIntro: string;
}

export interface ListingDoc extends BaseDoc {
  publicId?: string;
  slug?: string;
  title?: string;
  description?: string;
  displayName?: string;
  age?: number;
  categorySlug?: string;
  stateSlug?: string;
  citySlug?: string;
  districtSlug?: string;
  place?: string;
  chips?: string[];
  photos?: string[];
  photoCountVisible?: number;
  variant?: string;
  verified?: boolean;
  subscriber?: boolean;
  lastBumpedAt?: Date;
  publishedAt?: Date;
  status?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  emailOn?: boolean;
  tags?: unknown;
}

export interface SeoTemplateDoc extends BaseDoc {
  pageType: string;
  title: string;
  description: string;
  h1: string;
  h2: string;
  intro: string;
  footer: string;
}

export interface SiteDoc extends BaseDoc {
  key: string;
  name: string;
  tagline: string;
  legalName: string;
  countryName: string;
  supportHours: string;
  supportWhatsapp: string;
  supportTelegram: string;
  ageGateEnabled: boolean;
  ageGateTitle: string;
  ageGateBody: string;
  ageYes: string;
  ageNo: string;
  cookieBody: string;
  cookieAccept: string;
  cookieNecessary: string;
  searchPlaceholder: string;
  postCta: string;
  logoText: string;
  theme: unknown;
  footerLinks: unknown;
  socialLinks: unknown;
  homepage: unknown;
}

export interface PageDoc extends BaseDoc {
  slug: string;
  title: string;
  body: string;
  status: string;
}

export interface HelpArticleDoc extends BaseDoc {
  slug: string;
  title: string;
  body: string;
  section: string;
  order: number;
  status: string;
}

export interface BlogPostDoc extends BaseDoc {
  slug: string;
  title: string;
  body: string;
  date: string;
  author: string;
  status: string;
}

export interface CreditPackDoc extends BaseDoc {
  credits: number;
  price: number;
  bonus: number;
  tag: string;
  order: number;
  status: string;
}

interface BannerDoc extends BaseDoc {
  slot: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  enabled: boolean;
  order: number;
}

interface CouponDoc extends BaseDoc {
  code: string;
  label: string;
  value: string;
  expiry: string;
  status: string;
}

interface BannedWordDoc extends BaseDoc {
  text: string;
  matchType: string;
  scope: string;
  action: string;
}

interface FeatureFlagDoc extends BaseDoc {
  key: string;
  label: string;
  enabled: boolean;
}

interface AttributeGroupDoc extends BaseDoc {
  key: string;
  label: string;
  type: string;
  options: string[];
  order: number;
}

interface ProductDoc extends BaseDoc {
  name: string;
  slug: string;
  benefits: string;
  credits: number;
  status: string;
}

export const Category = model<CategoryDoc>("Category", CategorySchema);
export const Location = model<LocationDoc>("Location", LocationSchema);
export const Listing = model<ListingDoc>("Listing", ListingSchema);
export const SeoTemplate = model<SeoTemplateDoc>("SeoTemplate", SeoTemplateSchema);
export const Site = model<SiteDoc>("Site", SiteSchema);
export const Page = model<PageDoc>("Page", PageSchema);
export const HelpArticle = model<HelpArticleDoc>("HelpArticle", HelpArticleSchema);
export const BlogPost = model<BlogPostDoc>("BlogPost", BlogPostSchema);
export const CreditPack = model<CreditPackDoc>("CreditPack", CreditPackSchema);
export const Banner = model<BannerDoc>("Banner", BannerSchema);
export const Coupon = model<CouponDoc>("Coupon", CouponSchema);
export const BannedWord = model<BannedWordDoc>("BannedWord", BannedWordSchema);
export const FeatureFlag = model<FeatureFlagDoc>("FeatureFlag", FeatureFlagSchema);
export const AttributeGroup = model<AttributeGroupDoc>("AttributeGroup", AttributeGroupSchema);
export const Product = model<ProductDoc>("Product", ProductSchema);

export const MODEL_MAP = {
  Site,
  Category,
  Location,
  Listing,
  SeoTemplate,
  Page,
  HelpArticle,
  BlogPost,
  CreditPack,
  Banner,
  Coupon,
  BannedWord,
  FeatureFlag,
  AttributeGroup,
  Product,
} as const;

export type ModelName = keyof typeof MODEL_MAP;
