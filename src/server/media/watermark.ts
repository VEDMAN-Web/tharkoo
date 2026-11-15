import mongoose, { type Model } from "mongoose";
import { connectDb } from "@/lib/db";
import { PolicyViolationError } from "@/server/http";
import { CLOUDINARY_FOLDER } from "@/server/media/config";
import { readWatermarkSettings, type WatermarkPosition, type WatermarkSettings } from "@/server/settings/watermark";

/**
 * H6.18 approach: the watermark is BURNED IN when an ad photo or video is stored.
 * - Cloudinary: an incoming transformation on the upload. Cloudinary stores the transformed file, so the stored
 *   original already carries the mark. Stripping the transformation from a public URL returns the marked file.
 * - Local disk (no Cloudinary, dev only): sharp draws the mark on photos before the file is written.
 *   Videos are refused while the watermark is on, because there is no video tool on the server.
 * Site media, ID documents and chat images never pass through here.
 */

export const WATERMARK_TEXT = "tharkoo.com";
/** The mark is about 22 percent of the media width, so it stays readable on a phone thumbnail. */
const WIDTH_SHARE = 0.22;
const EDGE_SHARE = 0.02;
const WATERMARK_FONT = "Arial_100_bold";

const SHARP_GRAVITY: Record<WatermarkPosition, string> = {
  north_west: "northwest",
  north_east: "northeast",
  south_west: "southwest",
  south_east: "southeast",
  center: "centre",
};

/** The Cloudinary incoming transformation for one watermark setting. Pure. */
export function cloudinaryWatermarkTransformation(settings: WatermarkSettings): string {
  const placement = settings.position === "center" ? "g_center" : `g_${settings.position},x_16,y_16`;
  return `l_text:${WATERMARK_FONT}:${WATERMARK_TEXT},co_white/c_fit,w_${WIDTH_SHARE},fl_relative,o_${settings.opacity}/fl_layer_apply,${placement}`;
}

/** The SVG the local photo path draws. Its width is exactly WIDTH_SHARE of the photo, plus a small margin. Pure. */
export function localWatermarkSvg(photoWidth: number, settings: WatermarkSettings): { svg: string; gravity: string } {
  const textWidth = Math.max(1, Math.round(photoWidth * WIDTH_SHARE));
  const pad = Math.max(8, Math.round(photoWidth * EDGE_SHARE));
  const fontSize = Math.max(8, Math.round(textWidth / (WATERMARK_TEXT.length * 0.62)));
  const width = textWidth + pad * 2;
  const height = Math.round(fontSize * 1.3) + pad * 2;
  const opacity = (settings.opacity / 100).toFixed(2);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<text x="${pad}" y="${pad + fontSize}" textLength="${textWidth}" lengthAdjust="spacingAndGlyphs" ` +
    `font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" ` +
    `fill="#ffffff" fill-opacity="${opacity}" stroke="#000000" stroke-opacity="${opacity}" stroke-width="${Math.max(1, Math.round(fontSize / 16))}">` +
    `${WATERMARK_TEXT}</text></svg>`;
  return { svg, gravity: SHARP_GRAVITY[settings.position] };
}

/** The Cloudinary folder for ad photos and videos. Only these uploads get the mark. */
export function isAdFolder(folder: string) {
  return folder === `${CLOUDINARY_FOLDER}/listings`;
}

/** The incoming transformation for an upload into this folder, or null when no mark applies. */
export async function watermarkTransformationFor(folder: string): Promise<string | null> {
  await connectDb();
  if (!isAdFolder(folder)) return null;
  const settings = await readWatermarkSettings();
  return settings.enabled ? cloudinaryWatermarkTransformation(settings) : null;
}

interface MarkRow {
  objectKey: string;
  at: Date;
}

const WatermarkedMediaModel: Model<MarkRow> =
  (mongoose.models.WatermarkedMedia as Model<MarkRow> | undefined) ??
  mongoose.model<MarkRow>(
    "WatermarkedMedia",
    new mongoose.Schema<MarkRow>(
      { objectKey: { type: String, required: true, unique: true }, at: { type: Date, required: true } },
      { collection: "watermarked_media", versionKey: false },
    ),
  );

/** Records that a stored file already carries the mark, so the daily migration skips it. Idempotent. */
export async function markWatermarked(objectKey: string) {
  await connectDb();
  await WatermarkedMediaModel.updateOne({ objectKey }, { $setOnInsert: { objectKey, at: new Date() } }, { upsert: true });
}

export async function isWatermarked(objectKey: string) {
  await connectDb();
  return (await WatermarkedMediaModel.exists({ objectKey })) !== null;
}

async function loadSharp() {
  try {
    const mod = (await import("sharp")) as unknown as { default?: unknown };
    return (mod.default ?? mod) as (input: Buffer) => SharpLike;
  } catch {
    throw new PolicyViolationError("Photos cannot be watermarked on this server. Add the Cloudinary settings, or turn the watermark off in Settings.");
  }
}

interface SharpLike {
  rotate(): SharpLike;
  toBuffer(): Promise<Buffer>;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Buffer; info: { width: number; height: number } }>;
  composite(layers: { input: Buffer; gravity: string }[]): SharpLike;
  toFormat(format: "jpeg" | "png" | "webp"): SharpLike;
  resize(options: { width: number; height: number; fit: "inside"; withoutEnlargement: true }): SharpLike;
  png(): SharpLike;
}

function formatOf(contentType: string): "jpeg" | "png" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpeg";
}

/** Draws the mark on a local photo. Output is re-encoded, so EXIF data is dropped and the rotation is applied. */
export async function watermarkLocalPhoto(data: Buffer, contentType: string, settings: WatermarkSettings): Promise<Buffer> {
  const sharp = await loadSharp();
  const base = await sharp(data).rotate().toBuffer({ resolveWithObject: true });
  const { svg, gravity } = localWatermarkSvg(base.info.width, settings);
  // H6.19: a very small photo cannot hold the full mark, so the mark is shrunk to fit and the composite never overflows.
  const overlay = await sharp(Buffer.from(svg))
    .resize({ width: base.info.width, height: base.info.height, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const out = sharp(base.data).composite([{ input: overlay, gravity }]).toFormat(formatOf(contentType));
  return out.toBuffer();
}

/** Local videos cannot be marked here, so they are refused while the watermark is on. */
export const LOCAL_VIDEO_WATERMARK_MESSAGE =
  "Videos need Cloudinary on this server while the watermark is on. Turn the watermark off in Settings, or add the Cloudinary settings.";

export async function assertLocalVideoAllowed() {
  await connectDb();
  const settings = await readWatermarkSettings();
  if (settings.enabled) throw new PolicyViolationError(LOCAL_VIDEO_WATERMARK_MESSAGE);
}

/**
 * Local disk fallback. Returns the bytes to store: a photo with the mark, or the same bytes when no mark applies.
 * A video is refused while the watermark is on, because it cannot be marked here.
 */
export async function prepareLocalAdFile(
  kind: "image" | "video",
  file: { type: string; data: Buffer },
): Promise<{ data: Buffer; watermarked: boolean }> {
  await connectDb();
  const settings = await readWatermarkSettings();
  if (!settings.enabled) return { data: file.data, watermarked: false };
  if (kind === "video") {
    await assertLocalVideoAllowed();
    return { data: file.data, watermarked: false };
  }
  return { data: await watermarkLocalPhoto(file.data, file.type, settings), watermarked: true };
}
