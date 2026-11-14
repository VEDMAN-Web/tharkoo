import path from "node:path";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { uploadToCloudinary } from "@/server/media/client";
import { cloudinaryEnv, STRIP_EXIF } from "@/server/media/config";
import { isWatermarked } from "@/server/media/watermark";
import { readWatermarkSettings } from "@/server/settings/watermark";
import { MediaAsset } from "@/server/models";

/** Ad media handled per daily run. Each one downloads and re-uploads a file, so the batch stays small. */
export const WATERMARK_MIGRATION_BATCH = 10;
const PAGE_SIZE = 50;
const audit = new AuditRepository();

export interface WatermarkMigrationResult {
  /** False when the watermark is off: nothing is changed then. */
  enabled: boolean;
  /** Stored ad media that was watermarked in this run. */
  processed: number;
  /** Failed in this run. The next daily run tries again. */
  failed: number;
}

/**
 * H6.18: the daily cron watermarks ad media uploaded before the watermark existed. Idempotent: a file with a mark
 * on record is skipped, and a finished file is never marked twice. The stored original is downloaded from its
 * public URL (it has no mark yet), then re-uploaded under the same public id with the mark as an incoming transformation.
 * Local-disk files are not in this run (dev only, no public production path).
 */
export async function watermarkExistingAdMedia(requestId: string, batch = WATERMARK_MIGRATION_BATCH): Promise<WatermarkMigrationResult> {
  await connectDb();
  const settings = await readWatermarkSettings();
  if (!settings.enabled) return { enabled: false, processed: 0, failed: 0 };
  let processed = 0;
  let failed = 0;
  let lastId: string | null = null;
  while (processed < batch) {
    const query: Record<string, unknown> = {
      kind: { $in: ["image", "video"] },
      status: "cleared",
      objectKey: { $regex: /^tharkoo\/listings\// },
      ...(lastId ? { _id: { $gt: lastId } } : {}),
    };
    const page = await MediaAsset.find(query).sort({ _id: 1 }).limit(PAGE_SIZE).select("kind objectKey contentType").lean<
      { _id: { toString(): string }; kind: "image" | "video"; objectKey: string; contentType?: string }[]
    >();
    if (page.length === 0) break;
    for (const asset of page) {
      lastId = asset._id.toString();
      if (processed >= batch) break;
      if (await isWatermarked(asset.objectKey)) continue;
      try {
        await watermarkStored(asset);
        processed += 1;
      } catch (error) {
        failed += 1;
        console.error("ad media watermark failed", { mediaId: lastId, message: error instanceof Error ? error.message : "unknown" });
      }
    }
    if (page.length < PAGE_SIZE) break;
  }
  if (processed > 0 || failed > 0) {
    await audit.append({
      actorType: "system",
      action: "media.watermark_migrate",
      targetType: "media",
      targetId: "ad-media",
      requestId,
      after: { processed, failed },
    });
  }
  return { enabled: true, processed, failed };
}

async function watermarkStored(asset: { kind: "image" | "video"; objectKey: string; contentType?: string }) {
  const env = cloudinaryEnv();
  const resource = asset.kind === "video" ? "video" : "image";
  const response = await fetch(`https://res.cloudinary.com/${env.cloudName}/${resource}/upload/${asset.objectKey}`);
  if (!response.ok) throw new Error(`original not readable (${response.status})`);
  const data = Buffer.from(await response.arrayBuffer());
  const contentType = asset.contentType || (asset.kind === "video" ? "video/mp4" : "image/jpeg");
  await uploadToCloudinary(data, {
    contentType,
    folder: path.posix.dirname(asset.objectKey),
    publicId: path.posix.basename(asset.objectKey),
    resourceType: resource,
    overwrite: true,
    ...(asset.kind === "image" ? { transformation: STRIP_EXIF } : {}),
  });
}
