import { MongoClient } from "mongodb";

/** The compound indexes the live listing find relies on (H7.92). Same keys as the Listing schema. */
export const WANTED = [
  { name: "status_1_categoryId_1_cityId_1_publishedAt_-1", key: { status: 1, categoryId: 1, cityId: 1, publishedAt: -1 } },
  { name: "status_1_stateId_1_publishedAt_-1", key: { status: 1, stateId: 1, publishedAt: -1 } },
  { name: "status_1_cityId_1_publishedAt_-1", key: { status: 1, cityId: 1, publishedAt: -1 } },
  { name: "status_1_publishedAt_-1", key: { status: 1, publishedAt: -1 } },
];

/**
 * Lists the indexes of the listings collection and the wanted ones that are missing. Dry run unless `apply` is true.
 * With apply it creates only the missing ones (createIndex is safe to repeat; MongoDB 4.2 and later builds without blocking reads and writes).
 */
export async function syncListingIndexes(db, { apply = false } = {}) {
  const listings = db.collection("listings");
  const existing = (await listings.indexes().catch(() => [])).map((index) => index.name);
  const missing = WANTED.filter((wanted) => !existing.includes(wanted.name));
  const created = [];
  if (apply) {
    for (const wanted of missing) {
      await listings.createIndex(wanted.key, { name: wanted.name });
      created.push(wanted.name);
    }
  }
  return { apply, existing, missing: missing.map((item) => item.name), created };
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
    const result = await syncListingIndexes(client.db(), { apply });
    console.log(`SYNC_LISTING_INDEXES ${apply ? "APPLIED" : "DRY RUN"} ${JSON.stringify(result)}`);
    if (!apply) console.log("Nothing was changed. Run again with --apply to create the missing indexes.");
  } finally {
    await client.close();
  }
}

if ((process.argv[1] ?? "").includes("sync-listing-indexes")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Index sync failed");
    process.exit(1);
  });
}
