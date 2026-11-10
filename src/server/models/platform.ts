import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export interface ContentPageDoc {
  _id?: Types.ObjectId;
  slug: string;
  title: string;
  body?: string;
  metaDescription?: string;
  canonical?: string;
  noindex?: boolean;
  enabled?: boolean;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SiteSettingsDoc {
  _id?: Types.ObjectId;
  key: string;
  orgName?: string;
  legalName?: string;
  url?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  sameAs?: string[];
  cityCategoryThreshold?: number;
  localityThreshold?: number;
  defaultTitleTemplate?: string;
  defaultDescriptionTemplate?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SeedBackupDoc {
  _id?: Types.ObjectId;
  batch: string;
  takenAt: Date;
  counts: {
    locations: number;
    categories: number;
    promotion_products: number;
  };
  collections: Record<string, unknown>;
}

const contentPageSchema = new Schema<ContentPageDoc>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    metaDescription: { type: String, default: "" },
    canonical: { type: String, default: "" },
    noindex: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: collectionName("content_pages", "ContentPage") },
);

const siteSettingsSchema = new Schema<SiteSettingsDoc>(
  {
    key: { type: String, required: true, unique: true, default: "site" },
    orgName: { type: String, default: "" },
    legalName: { type: String, default: "" },
    url: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    sameAs: { type: [String], default: [] },
    cityCategoryThreshold: { type: Number, default: 3 },
    localityThreshold: { type: Number, default: 10 },
    defaultTitleTemplate: { type: String, default: "" },
    defaultDescriptionTemplate: { type: String, default: "" },
  },
  { timestamps: true, collection: collectionName("site_settings", "SiteSettings") },
);

const seedBackupSchema = new Schema<SeedBackupDoc>(
  {
    batch: { type: String, required: true, index: true },
    takenAt: { type: Date, required: true },
    counts: {
      locations: { type: Number, required: true },
      categories: { type: Number, required: true },
      promotion_products: { type: Number, required: true },
    },
    collections: { type: Schema.Types.Mixed, required: true },
  },
  { collection: collectionName("seed_backups", "SeedBackup") },
);

export const ContentPage = registerModel<ContentPageDoc>(modelName("ContentPage"), contentPageSchema);
export const SiteSettings = registerModel<SiteSettingsDoc>(
  modelName("SiteSettings"),
  siteSettingsSchema,
);
export const SeedBackup = registerModel<SeedBackupDoc>(modelName("SeedBackup"), seedBackupSchema);
