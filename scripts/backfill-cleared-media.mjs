import { MongoClient } from "mongodb";

const NOT_LOCAL = { $not: /^(\/uploads\/|private:|pending)/ };

export const STUCK = { kind: "image", status: "scanning", objectKey: NOT_LOCAL };

/**
 * Photos that passed the scan but were left on "scanning" can never be published. This moves them to "cleared"
 * with clearedAt = updatedAt. Dry run unless `apply` is true. Safe to run twice: the second run finds nothing.
 */
export async function backfillClearedMedia(db, { apply = false } = {}) {
  const media = db.collection("media_assets");
  const stuck = await media.countDocuments(STUCK);
  const sample = (await media.find(STUCK).project({ _id: 1 }).limit(5).toArray()).map((row) => String(row._id));
  if (!apply) return { apply: false, stuck, changed: 0, sample };
  const result = await media.updateMany(STUCK, [{ $set: { status: "cleared", clearedAt: { $ifNull: ["$updatedAt", { $ifNull: ["$createdAt", "$$NOW"] }] } } }]);
  return { apply: true, stuck, changed: result.modifiedCount, sample };
}

async function main() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("Set MONGODB_URI to the database to look at. Nothing is written without --apply.");
    process.exit(1);
  }
  const apply = process.argv.includes("--apply");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const result = await backfillClearedMedia(client.db(), { apply });
    console.log(`BACKFILL_CLEARED_MEDIA ${apply ? "APPLIED" : "DRY RUN"} ${JSON.stringify(result)}`);
    if (!apply) console.log("Nothing was changed. Run again with --apply to write.");
  } finally {
    await client.close();
  }
}

if ((process.argv[1] ?? "").includes("backfill-cleared-media")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed");
    process.exit(1);
  });
}
