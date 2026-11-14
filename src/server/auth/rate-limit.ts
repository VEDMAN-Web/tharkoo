import { Schema } from "mongoose";
import { connectDb } from "@/lib/db";
import { isDuplicateKey } from "@/server/http";
import { registerModel } from "@/server/models/register";

interface RateDoc {
  key: string;
  count: number;
  expiresAt: Date;
}

const schema = new Schema<RateDoc>(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "auth_rate_limits" },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthRateLimit = registerModel<RateDoc>("AuthRateLimit", schema);

/** Mongo counter with a TTL index so a process restart keeps the window. */
export async function consumeRateLimit(key: string, max: number, windowMs: number) {
  await connectDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  let doc = await AuthRateLimit.findOneAndUpdate(
    { key, expiresAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );
  if (!doc) {
    try {
      doc = await AuthRateLimit.findOneAndUpdate(
        { key },
        { $set: { count: 1, expiresAt } },
        { upsert: true, returnDocument: "after" },
      );
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      doc = await AuthRateLimit.findOneAndUpdate(
        { key, expiresAt: { $gt: new Date() } },
        { $inc: { count: 1 } },
        { returnDocument: "after" },
      );
    }
  }
  const retryAfter = Math.max(1, Math.ceil(((doc?.expiresAt ?? expiresAt).getTime() - Date.now()) / 1000));
  return { ok: Boolean(doc && doc.count <= max), retryAfter };
}

/** Clears a counter, so an action that was charged but never happened does not use up its window. */
export async function resetRateLimit(key: string) {
  await connectDb();
  await AuthRateLimit.deleteOne({ key });
}
