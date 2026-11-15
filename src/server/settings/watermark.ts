import mongoose, { type Model } from "mongoose";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, parseInput } from "@/server/http";
import { normaliseWatermark, watermarkBodySchema, type WatermarkSettings } from "@/server/settings/watermark-rules";

/**
 * H6.18: the "tharkoo.com" watermark on ad photos and videos. Superadmin only, audited.
 * The rules and defaults are in ./watermark-rules.ts. The values live in their own small collection, so the Site model is not touched.
 */

export { WATERMARK_DEFAULTS, WATERMARK_OPACITY_MAX, WATERMARK_OPACITY_MIN, WATERMARK_POSITIONS, normaliseWatermark, watermarkBodySchema } from "@/server/settings/watermark-rules";
export type { WatermarkPosition, WatermarkSettings } from "@/server/settings/watermark-rules";

const SETTING_KEY = "default";
const audit = new AuditRepository();

interface WatermarkSettingRow {
  key: string;
  enabled?: boolean;
  position?: string;
  opacity?: number;
}

const WatermarkSettingModel: Model<WatermarkSettingRow> =
  (mongoose.models.WatermarkSetting as Model<WatermarkSettingRow> | undefined) ??
  mongoose.model<WatermarkSettingRow>(
    "WatermarkSetting",
    new mongoose.Schema<WatermarkSettingRow>(
      { key: { type: String, required: true, unique: true }, enabled: Boolean, position: String, opacity: Number },
      { collection: "watermark_settings", versionKey: false },
    ),
  );

/** The settings in force now. Any server code may read this; only the write is restricted. */
export async function readWatermarkSettings(): Promise<WatermarkSettings> {
  await connectDb();
  const row = await WatermarkSettingModel.findOne({ key: SETTING_KEY }).lean<WatermarkSettingRow | null>();
  return normaliseWatermark(row);
}

/** Superadmin only. Writes the three values and an audit entry with the values before and after. */
export async function setWatermarkSettings(input: { actorId: string; roles: readonly string[]; settings: unknown; requestId: string }) {
  await connectDb();
  if (!input.roles.includes("superadmin")) throw new ForbiddenError("Only a superadmin can change this setting");
  const next = parseInput(watermarkBodySchema, input.settings);
  const before = await readWatermarkSettings();
  await WatermarkSettingModel.updateOne({ key: SETTING_KEY }, { $set: next }, { upsert: true });
  await audit.append({
    actorId: input.actorId,
    actorType: "admin",
    action: "settings.watermark.update",
    targetType: "site",
    targetId: SETTING_KEY,
    requestId: input.requestId,
    before: { ...before },
    after: { ...next },
  });
  return next;
}
