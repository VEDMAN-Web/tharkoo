import { Site } from "@/server/models/cms";
import { DEFAULT_RANK_SETTINGS, normaliseRankSettings, type RankSettings } from "@/server/ranking/settings";
import { connectDb } from "@/lib/db";

/** Reads `site.ranking`; a missing or broken value gives the defaults. */
export async function loadRankSettings(): Promise<RankSettings> {
  await connectDb();
  const site = await Site.findOne({ key: "default" }).select("ranking").lean();
  return site?.ranking ? normaliseRankSettings(site.ranking) : DEFAULT_RANK_SETTINGS;
}
