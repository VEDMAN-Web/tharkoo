import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** One admin-managed choice for a pick-many or pick-one field. Sellers never write here. */
export interface CategoryFieldOptionDoc {
  _id?: Types.ObjectId;
  categorySlug: string;
  fieldKey: string;
  value: string;
  /** Lower-cased value, so one list cannot hold the same option twice. */
  valueKey: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const optionSchema = new Schema<CategoryFieldOptionDoc>(
  {
    categorySlug: { type: String, required: true },
    fieldKey: { type: String, required: true },
    value: { type: String, required: true, maxlength: 80 },
    valueKey: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: collectionName("category_field_options", "CategoryFieldOption") },
);
optionSchema.index({ categorySlug: 1, fieldKey: 1, valueKey: 1 }, { unique: true });
optionSchema.index({ categorySlug: 1, fieldKey: 1, order: 1 });

/** Settings that a field carries besides its options: the filter name and the most a user may pick. */
export interface CategoryFieldSettingDoc {
  _id?: Types.ObjectId;
  categorySlug: string;
  fieldKey: string;
  /** The name shown in the listing filters. Empty means the field label is used. */
  filterLabel: string;
  /** Most options a user may pick for a pick-many field. Null means no limit. */
  maxPicks: number | null;
  updatedAt?: Date;
}

const settingSchema = new Schema<CategoryFieldSettingDoc>(
  {
    categorySlug: { type: String, required: true },
    fieldKey: { type: String, required: true },
    filterLabel: { type: String, default: "", maxlength: 40 },
    maxPicks: { type: Number, default: null, min: 1, max: 50 },
  },
  { timestamps: true, collection: collectionName("category_field_settings", "CategoryFieldSetting") },
);
settingSchema.index({ categorySlug: 1, fieldKey: 1 }, { unique: true });

export const CategoryFieldOption = registerModel<CategoryFieldOptionDoc>(modelName("CategoryFieldOption"), optionSchema);
export const CategoryFieldSetting = registerModel<CategoryFieldSettingDoc>(modelName("CategoryFieldSetting"), settingSchema);
