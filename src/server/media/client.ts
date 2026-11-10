import { v2 as cloudinary } from "cloudinary";
import { cloudinaryEnv } from "@/server/media/config";

export interface RemoteAsset {
  bytes: number;
  format: string;
}

export type Delivery = "upload" | "authenticated";

export interface CloudinaryClient {
  resource(publicId: string, type: Delivery): Promise<RemoteAsset | null>;
  destroy(publicId: string, type: Delivery): Promise<void>;
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
    async resource(publicId, type) {
      configure();
      try {
        const found = (await cloudinary.api.resource(publicId, { resource_type: "image", type })) as {
          bytes?: number;
          format?: string;
        };
        return { bytes: Number(found.bytes) || 0, format: String(found.format || "") };
      } catch (error) {
        if (httpCode(error) === 404) return null;
        throw error;
      }
    },
    async destroy(publicId, type) {
      configure();
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", type, invalidate: true });
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

export function cloudinaryClient() {
  return override ?? liveClient();
}
