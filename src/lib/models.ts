import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema(
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

const LocationSchema = new Schema(
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

const ListingSchema = new Schema(
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

const SeoTemplateSchema = new Schema({
  pageType: { type: String, unique: true },
  title: String,
  description: String,
  h1: String,
  h2: String,
  intro: String,
  footer: String,
});

const SiteSchema = new Schema(
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

const PageSchema = new Schema(
  {
    slug: { type: String, unique: true },
    title: String,
    body: String,
    status: { type: String, default: "published" },
  },
  { timestamps: true },
);

const HelpArticleSchema = new Schema(
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

const BlogPostSchema = new Schema(
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

const CreditPackSchema = new Schema({
  credits: Number,
  price: Number,
  bonus: Number,
  tag: String,
  order: Number,
  status: { type: String, default: "active" },
});

const BannerSchema = new Schema({
  slot: String,
  title: String,
  body: String,
  href: String,
  cta: String,
  enabled: { type: Boolean, default: true },
  order: Number,
});

const CouponSchema = new Schema({
  code: String,
  label: String,
  value: String,
  expiry: String,
  status: { type: String, default: "active" },
});

const BannedWordSchema = new Schema({
  text: String,
  matchType: String,
  scope: String,
  action: String,
});

const FeatureFlagSchema = new Schema({
  key: { type: String, unique: true },
  label: String,
  enabled: { type: Boolean, default: true },
});

const AttributeGroupSchema = new Schema({
  key: String,
  label: String,
  type: String,
  options: [String],
  order: Number,
});

const ProductSchema = new Schema({
  name: String,
  slug: String,
  benefits: String,
  credits: Number,
  status: { type: String, default: "active" },
});

function model<T>(name: string, schema: Schema) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}

export type CategoryDoc = mongoose.InferSchemaType<typeof CategorySchema> & { _id: mongoose.Types.ObjectId };
export type LocationDoc = mongoose.InferSchemaType<typeof LocationSchema> & { _id: mongoose.Types.ObjectId };
export type ListingDoc = mongoose.InferSchemaType<typeof ListingSchema> & { _id: mongoose.Types.ObjectId };
export type SeoTemplateDoc = mongoose.InferSchemaType<typeof SeoTemplateSchema> & { _id: mongoose.Types.ObjectId };
export type SiteDoc = mongoose.InferSchemaType<typeof SiteSchema> & { _id: mongoose.Types.ObjectId };
export type PageDoc = mongoose.InferSchemaType<typeof PageSchema> & { _id: mongoose.Types.ObjectId };
export type HelpArticleDoc = mongoose.InferSchemaType<typeof HelpArticleSchema> & { _id: mongoose.Types.ObjectId };
export type BlogPostDoc = mongoose.InferSchemaType<typeof BlogPostSchema> & { _id: mongoose.Types.ObjectId };
export type CreditPackDoc = mongoose.InferSchemaType<typeof CreditPackSchema> & { _id: mongoose.Types.ObjectId };

export const Category = model<CategoryDoc>("Category", CategorySchema);
export const Location = model<LocationDoc>("Location", LocationSchema);
export const Listing = model<ListingDoc>("Listing", ListingSchema);
export const SeoTemplate = model<SeoTemplateDoc>("SeoTemplate", SeoTemplateSchema);
export const Site = model<SiteDoc>("Site", SiteSchema);
export const Page = model<PageDoc>("Page", PageSchema);
export const HelpArticle = model<HelpArticleDoc>("HelpArticle", HelpArticleSchema);
export const BlogPost = model<BlogPostDoc>("BlogPost", BlogPostSchema);
export const CreditPack = model<CreditPackDoc>("CreditPack", CreditPackSchema);
export const Banner = model("Banner", BannerSchema);
export const Coupon = model("Coupon", CouponSchema);
export const BannedWord = model("BannedWord", BannedWordSchema);
export const FeatureFlag = model("FeatureFlag", FeatureFlagSchema);
export const AttributeGroup = model("AttributeGroup", AttributeGroupSchema);
export const Product = model("Product", ProductSchema);

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
