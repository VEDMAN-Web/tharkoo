import { CLOUDINARY_FOLDER, optionalCloudinary } from "@/server/media/config";

const LISTING_KEY = new RegExp(`^${CLOUDINARY_FOLDER}/listings/[A-Za-z0-9_-]+$`);
const DELIVERY = "c_limit,w_1280,f_auto,q_auto";

export function adPhotoUrl(objectKey: string): string | null {
  if (objectKey.startsWith("/") || /^https?:\/\//.test(objectKey)) return objectKey;
  if (!LISTING_KEY.test(objectKey)) return null;
  const env = optionalCloudinary();
  return env ? `https://res.cloudinary.com/${env.cloudName}/image/upload/${DELIVERY}/${objectKey}` : null;
}
