import { AuditEvent } from "@/server/models/trust";
import { ContentPage, SeedBackup, SiteSettings } from "@/server/models/platform";
import { EmailVerificationToken, IdentityVerification, PasswordResetToken, Session, User } from "@/server/models/identity";
import { Category, Location } from "@/server/models/catalog";
import { Favourite, Listing, ListingVersion, MediaAsset, Message, SavedSearch, Thread } from "@/server/models/listing";
import { ModerationCase, Report } from "@/server/models/trust";
import { Payment, PromotionOrder, PromotionProduct, WalletEntry } from "@/server/models/billing";
import {
  AttributeGroup,
  BannedWord,
  Banner,
  BlogPost,
  Coupon,
  CreditPack,
  FeatureFlag,
  HelpArticle,
  Page,
  Product,
  SeoTemplate,
  Site,
} from "@/server/models/cms";

export { V2, COLL_SUFFIX, CLASHING_MODELS, modelName, collectionName } from "@/server/models/names";
export { registerModel } from "@/server/models/register";

export {
  User,
  Session,
  EmailVerificationToken,
  PasswordResetToken,
  IdentityVerification,
} from "@/server/models/identity";
export type { UserDoc, SessionDoc, TokenDoc, IdentityVerificationDoc } from "@/server/models/identity";

export { Category, Location } from "@/server/models/catalog";
export type { CategoryDoc, CategoryFieldDoc, FaqDoc, LocationDoc, LocationLevel } from "@/server/models/catalog";

export {
  Listing,
  ListingVersion,
  MediaAsset,
  Favourite,
  SavedSearch,
  Thread,
  Message,
} from "@/server/models/listing";
export type {
  FavouriteDoc,
  SavedSearchDoc,
  ListingContactDoc,
  ListingDoc,
  ListingStatus,
  ListingVersionDoc,
  MediaAssetDoc,
  MediaStatus,
  MessageDoc,
  ThreadDoc,
} from "@/server/models/listing";

export { Report, ModerationCase, AuditEvent } from "@/server/models/trust";
export type {
  AuditEventDoc,
  ModerationCaseDoc,
  ModerationCaseType,
  ReportDoc,
  ReportReason,
  Severity,
} from "@/server/models/trust";

export { PromotionProduct, PromotionOrder, Payment, WalletEntry } from "@/server/models/billing";
export type {
  PaymentDoc,
  PromotionOrderDoc,
  PromotionProductDoc,
  WalletEntryDoc,
} from "@/server/models/billing";

export { ContentPage, SiteSettings, SeedBackup } from "@/server/models/platform";
export type { ContentPageDoc, SeedBackupDoc, SiteSettingsDoc } from "@/server/models/platform";

export {
  SeoTemplate,
  Site,
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
} from "@/server/models/cms";
export type {
  AttributeGroupDoc,
  BannedWordDoc,
  BannerDoc,
  BlogPostDoc,
  CouponDoc,
  CreditPackDoc,
  FeatureFlagDoc,
  HelpArticleDoc,
  PageDoc,
  ProductDoc,
  SeoTemplateDoc,
  SiteDoc,
} from "@/server/models/cms";

export const allModels = [
  User,
  Session,
  EmailVerificationToken,
  PasswordResetToken,
  IdentityVerification,
  Category,
  Location,
  Listing,
  ListingVersion,
  MediaAsset,
  Favourite,
  Thread,
  Message,
  Report,
  ModerationCase,
  PromotionProduct,
  PromotionOrder,
  Payment,
  WalletEntry,
  AuditEvent,
  SiteSettings,
  ContentPage,
  SeedBackup,
  SeoTemplate,
  Site,
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
];
