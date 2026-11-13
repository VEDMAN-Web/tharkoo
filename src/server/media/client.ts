import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnv } from "@/server/media/config";

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

export type CloudinaryUploader = (data: Buffer, options: { contentType: string; folder: string; publicId: string }) => Promise<UploadedAsset>;

let uploaderOverride: CloudinaryUploader | null = null;

export function setCloudinaryUploader(uploader: CloudinaryUploader | null) {
  uploaderOverride = uploader;
}

/** Signed server-side upload. The secret stays on the server and is never logged. */
export async function uploadToCloudinary(data: Buffer, options: { contentType: string; folder: string; publicId: string }) {
  if (uploaderOverride) return uploaderOverride(data, options);
  configure();
  const result = await cloudinary.uploader.upload(`data:${options.contentType};base64,${data.toString("base64")}`, {
    resource_type: "image",
    type: "upload",
    folder: options.folder,
    public_id: options.publicId,
    overwrite: false,
  });
  return { url: result.secure_url, publicId: result.public_id } as UploadedAsset;
}

export function cloudinaryClient() {
  return override ?? liveClient();
}
