import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export interface FaqDoc {
  q?: string;
  a?: string;
}

export interface CategoryFieldDoc {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multiselect"
    | "boolean"
    | "bool"
    | "date"
    | "range";
  required?: boolean;
  options?: string[];
  min?: number | null;
  max?: number | null;
  unit?: string;
  order?: number;
  enabled?: boolean;
  filterable?: boolean;
  shownOnCard?: boolean;
  placeholder?: string;
  help?: string;
  optionLabels?: Record<string, string>;
}

export interface CategoryDoc {
  _id?: Types.ObjectId;
  slug: string;
  name: string;
  description?: string;
  parentId?: Types.ObjectId | null;
  enabled?: boolean;
  order?: number;
  fields?: CategoryFieldDoc[];
  oldSlugs?: string[];
  deletedAt?: Date | null;
  seoTitleTemplate?: string;
  seoDescriptionTemplate?: string;
  seoTitle?: string;
  seoDescription?: string;
  h1?: string;
  introHtml?: string;
  faqs?: FaqDoc[];
  noindex?: boolean;
  canonicalOverride?: string;
  minListingsIndex?: number;
  minListingsLocality?: number;
  seedBatch?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LocationLevel = "country" | "state" | "city" | "district" | "locality";

export interface LocationDoc {
  _id?: Types.ObjectId;
  type: LocationLevel;
  slug: string;
  name: string;
  parentId?: Types.ObjectId | null;
  enabled?: boolean;
  order?: number;
  countryCode?: string;
  oldSlugs?: string[];
  seoTitle?: string;
  seoDescription?: string;
  h1?: string;
  introHtml?: string;
  landingHtml?: string;
  faqs?: FaqDoc[];
  noindex?: boolean;
  canonicalOverride?: string;
  seedBatch?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const fieldDefinitionSchema = new Schema<CategoryFieldDoc>(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "text",
        "textarea",
        "number",
        "select",
        "multiselect",
        "boolean",
        "bool",
        "date",
        "range",
      ],
      required: true,
    },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    unit: { type: String, default: "" },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    filterable: { type: Boolean, default: true },
    shownOnCard: { type: Boolean, default: false },
    placeholder: { type: String, default: "" },
    help: { type: String, default: "" },
    optionLabels: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const categorySchema = new Schema<CategoryDoc>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    parentId: { type: Schema.Types.ObjectId, default: null },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    fields: { type: [fieldDefinitionSchema], default: [] },
    oldSlugs: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
    seoTitleTemplate: { type: String, default: "" },
    seoDescriptionTemplate: { type: String, default: "" },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    h1: { type: String, default: "" },
    introHtml: { type: String, default: "" },
    faqs: { type: [{ q: { type: String }, a: { type: String } }], default: [] },
    noindex: { type: Boolean, default: false },
    canonicalOverride: { type: String, default: "" },
    minListingsIndex: { type: Number, default: 3 },
    minListingsLocality: { type: Number, default: 10 },
    seedBatch: { type: String },
  },
  { timestamps: true, collection: collectionName("categories", "Category") },
);
categorySchema.index({ parentId: 1, order: 1 });
categorySchema.index({ oldSlugs: 1 });

const locationSchema = new Schema<LocationDoc>(
  {
    type: {
      type: String,
      enum: ["country", "state", "city", "district", "locality"],
      required: true,
    },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    countryCode: { type: String, default: "IN" },
    oldSlugs: { type: [String], default: [] },
    seoTitle: { type: String, default: "" },
    seoDescription: { type: String, default: "" },
    h1: { type: String, default: "" },
    introHtml: { type: String, default: "" },
    landingHtml: { type: String, default: "" },
    faqs: { type: [{ q: { type: String }, a: { type: String } }], default: [] },
    noindex: { type: Boolean, default: false },
    canonicalOverride: { type: String, default: "" },
    seedBatch: { type: String },
  },
  { timestamps: true, collection: collectionName("locations", "Location") },
);
locationSchema.index({ parentId: 1, type: 1, slug: 1 }, { unique: true });
locationSchema.index({ type: 1, enabled: 1, order: 1 });
locationSchema.index({ oldSlugs: 1 });

export const Category = registerModel<CategoryDoc>(modelName("Category"), categorySchema);
export const Location = registerModel<LocationDoc>(modelName("Location"), locationSchema);
