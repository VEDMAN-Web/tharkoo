import { Schema, type Types } from "mongoose";
import { registerModel } from "@/server/models/register";

export interface SubcategoryDoc {
  _id?: Types.ObjectId;
  categoryId: Types.ObjectId;
  slug: string;
  name: string;
  icon?: string;
  order?: number;
  enabled?: boolean;
  /** Short text shown at the top of the sub-category page. Plain text. */
  seoIntro?: string;
  oldSlugs?: string[];
  /** Overrides the category's live video tour switch when set. Null means inherit. */
  videoTourEnabled?: boolean | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const subcategorySchema = new Schema<SubcategoryDoc>(
  {
    categoryId: { type: Schema.Types.ObjectId, required: true, index: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    icon: { type: String, default: "" },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
    seoIntro: { type: String, default: "" },
    oldSlugs: { type: [String], default: [] },
    videoTourEnabled: { type: Boolean, default: null },
  },
  { timestamps: true, collection: "subcategories" },
);
subcategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true });
subcategorySchema.index({ categoryId: 1, order: 1 });

export const Subcategory = registerModel<SubcategoryDoc>("Subcategory", subcategorySchema);
