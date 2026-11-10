import type { Model } from "mongoose";
import {
  AttributeGroup as AttributeGroupModel,
  Banner as BannerModel,
  BannedWord as BannedWordModel,
  BlogPost as BlogPostModel,
  Category as CategoryModel,
  Coupon as CouponModel,
  CreditPack as CreditPackModel,
  FeatureFlag as FeatureFlagModel,
  HelpArticle as HelpArticleModel,
  Listing as ListingModel,
  Location as LocationModel,
  Page as PageModel,
  Product as ProductModel,
  SeoTemplate as SeoTemplateModel,
  Site as SiteModel,
} from "@/server/models";

/**
 * Compatibility shim for pages and admin that still import this path.
 * Runtime models are the T1.1 schemas (unsuffixed after the T5.1 flip).
 * The interfaces below are the pre-flip document shapes those pages read.
 * Remove this shim once T5.2, T7.1, and T7.2 import `@/server/models` directly.
 */

interface BaseDoc {
  _id?: unknown;
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
  details?: { label: string; value: string }[];
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

function asModel<T>(model: unknown): Model<T> {
  return model as Model<T>;
}

export const Category = asModel<CategoryDoc>(CategoryModel);
export const Location = asModel<LocationDoc>(LocationModel);
export const Listing = asModel<ListingDoc>(ListingModel);
export const SeoTemplate = asModel<SeoTemplateDoc>(SeoTemplateModel);
export const Site = asModel<SiteDoc>(SiteModel);
export const Page = asModel<PageDoc>(PageModel);
export const HelpArticle = asModel<HelpArticleDoc>(HelpArticleModel);
export const BlogPost = asModel<BlogPostDoc>(BlogPostModel);
export const CreditPack = asModel<CreditPackDoc>(CreditPackModel);
export const Banner = asModel<BannerDoc>(BannerModel);
export const Coupon = asModel<CouponDoc>(CouponModel);
export const BannedWord = asModel<BannedWordDoc>(BannedWordModel);
export const FeatureFlag = asModel<FeatureFlagDoc>(FeatureFlagModel);
export const AttributeGroup = asModel<AttributeGroupDoc>(AttributeGroupModel);
export const Product = asModel<ProductDoc>(ProductModel);

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
