import mongoose from "mongoose";
import { existsSync, readFileSync } from "node:fs";
import { Listing } from "../src/lib/models";

function uri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (!existsSync(".env.local")) return "";
  return readFileSync(".env.local", "utf8").match(/MONGODB_URI\s*=\s*['"]?([^'"\n]+)['"]?/)?.[1]?.trim() || "";
}

async function main() {
  const mongo = uri();
  if (!mongo) throw new Error("MONGODB_URI missing");
  await mongoose.connect(mongo);
  const listings = await Listing.find({ photos: { $exists: true, $ne: [] } });
  for (const listing of listings) {
    const photos = (listing.photos || []).map((p: string) => p.replace(/\.svg$/i, ".jpg"));
    listing.photos = photos;
    await listing.save();
  }
  await mongoose.disconnect();
  console.log(`photos_patched ${listings.length}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "patch failed");
  process.exit(1);
});
