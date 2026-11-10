import mongoose, { type Model, type Schema } from "mongoose";

export function registerModel<T>(name: string, schema: Schema<T>): Model<T> {
  const cached = mongoose.models[name] as Model<T> | undefined;
  return cached ?? mongoose.model<T>(name, schema);
}
