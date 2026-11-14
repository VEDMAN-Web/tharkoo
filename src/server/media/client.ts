import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnv } from "@/server/media/config";
import { markWatermarked, watermarkTransformationFor } from "@/server/media/watermark";

export interface RemoteAsset {
  bytes: number;
  format: string;
  /** Play length in seconds. Only set for videos. */
  duration?: number;
}

export type ResourceKind = "image" | "video";
export type Delivery = "upload" | "authenticated";

export interface CloudinaryClient {
  resource(publicId: string, type: Delivery, resourceType?: ResourceKind): Promise<RemoteAsset | null>;
  destroy(publicId: string, type: Delivery, resourceType?: ResourceKind): Promise<void>;
  list(prefix: string): Promise<string[]>;
  signedDownload(publicId: string, format: string, expiresAt: number): string;
}

let override: CloudinaryClient | null = null;

export function setCloudinaryClient(client: CloudinaryClient | null) {
  override = client;
}

function configure() {
  const env = cloudinaryEnv();
  cloudinary.config({ cloud_name: env.cloudName, api_key: env.apiKey, api_secret: env.apiSecret, secure: true });
}

function httpCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("error" in error)) return undefined;
  return (error as { error?: { http_code?: number } }).error?.http_code;
}

function liveClient(): CloudinaryClient {
  return {
    async resource(publicId, type, resourceType = "image") {
      configure();
      try {
        const found = (await cloudinary.api.resource(publicId, { resource_type: resourceType, type })) as {
          bytes?: number;
          format?: string;
          duration?: number;
        };
        return {
          bytes: Number(found.bytes) || 0,
          format: String(found.format || ""),
          ...(resourceType === "video" ? { duration: Number(found.duration) || 0 } : {}),
        };
      } catch (error) {
        if (httpCode(error) === 404) return null;
        throw error;
      }
    },
    async destroy(publicId, type, resourceType = "image") {
      configure();
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type, invalidate: true });
    },
    async list(prefix) {
      configure();
      const ids: string[] = [];
      for (const type of ["upload", "authenticated"] as const) {
        const page = (await cloudinary.api.resources({ resource_type: "image", type, prefix, max_results: 500 })) as {
          resources?: { public_id: string }[];
        };
        for (const item of page.resources ?? []) ids.push(item.public_id);
      }
      return ids;
    },
    signedDownload(publicId, format, expiresAt) {
      configure();
      return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: "image",
        type: "authenticated",
        expires_at: expiresAt,
      });
    },
  };
}

export interface UploadedAsset {
  url: string;
  publicId: string;
}

export interface UploadOptions {
  contentType: string;
  folder: string;
  publicId: string;
  /** Optional Cloudinary transformation string, for example the EXIF strip used for listing photos. */
  transformation?: string;
  /** Defaults to an image. Import videos are stored as video. */
  resourceType?: "image" | "video";
  /** Replaces the file already stored under publicId. Used only by the H6.18 watermark migration. */
  overwrite?: boolean;
}

export type CloudinaryUploader = (data: Buffer, options: UploadOptions) => Promise<UploadedAsset>;

let uploaderOverride: CloudinaryUploader | null = null;

export function setCloudinaryUploader(uploader: CloudinaryUploader | null) {
  uploaderOverride = uploader;
}

/**
 * Signed server-side upload. The secret stays on the server and is never logged.
 * H6.18: an upload into the listings folder (ad photos and videos) gets the watermark as an incoming transformation,
 * and is recorded as watermarked so the daily migration skips it.
 */
export async function uploadToCloudinary(data: Buffer, options: UploadOptions) {
  const watermark = await watermarkTransformationFor(options.folder);
  const transformation = [options.transformation, watermark].filter(Boolean).join("/") || undefined;
  const final: UploadOptions = { ...options, transformation };
  const stored = uploaderOverride ? await uploaderOverride(data, final) : await uploadRaw(data, final);
  if (watermark) await markWatermarked(stored.publicId);
  return stored;
}

async function uploadRaw(data: Buffer, options: UploadOptions): Promise<UploadedAsset> {
  configure();
  const result = await cloudinary.uploader.upload(`data:${options.contentType};base64,${data.toString("base64")}`, {
    resource_type: options.resourceType ?? "image",
    type: "upload",
    folder: options.folder,
    public_id: options.publicId,
    overwrite: options.overwrite ?? false,
    ...(options.overwrite ? { invalidate: true } : {}),
    ...(options.transformation ? { transformation: options.transformation } : {}),
  });
  return { url: result.secure_url, publicId: result.public_id } as UploadedAsset;
}

export function cloudinaryClient() {
  return override ?? liveClient();
}
