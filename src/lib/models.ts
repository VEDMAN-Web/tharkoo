import mongoose, { Schema } from "mongoose";

const CategorySchema = new Schema(
  {
    name: String,
    slug: { type: String, unique: true },
    description: String,
    icon: String,
    order: Number,
    starEnabled: { type: Boolean, default: false },
    status: { type: String, default: "active" },
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
    lat: Number,
    lng: Number,
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
ListingSchema.index({ categorySlug: 1, stateSlug: 1, lastBumpedAt: -1 });

const SeoTemplateSchema = new Schema({
  pageType: { type: String, unique: true },
  title: String,
  description: String,
  h1: String,
  h2: String,
  intro: String,
  footer: String,
});

const SiteSchema = new Schema({
  key: { type: String, unique: true },
  name: String,
  tagline: String,
  legalName: String,
  countryName: String,
  supportHours: String,
  ageGateEnabled: { type: Boolean, default: true },
});

function model<T>(name: string, schema: Schema) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}

export type CategoryDoc = mongoose.InferSchemaType<typeof CategorySchema> & { _id: mongoose.Types.ObjectId };
export type LocationDoc = mongoose.InferSchemaType<typeof LocationSchema> & { _id: mongoose.Types.ObjectId };
export type ListingDoc = mongoose.InferSchemaType<typeof ListingSchema> & { _id: mongoose.Types.ObjectId };
export type SeoTemplateDoc = mongoose.InferSchemaType<typeof SeoTemplateSchema> & { _id: mongoose.Types.ObjectId };
export type SiteDoc = mongoose.InferSchemaType<typeof SiteSchema> & { _id: mongoose.Types.ObjectId };

export const Category = model<CategoryDoc>("Category", CategorySchema);
export const Location = model<LocationDoc>("Location", LocationSchema);
export const Listing = model<ListingDoc>("Listing", ListingSchema);
export const SeoTemplate = model<SeoTemplateDoc>("SeoTemplate", SeoTemplateSchema);
export const Site = model<SiteDoc>("Site", SiteSchema);
