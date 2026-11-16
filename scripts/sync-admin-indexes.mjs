import { MongoClient } from "mongodb";

export const WANTED = [
  { collection: "listings", name: "status_1_lastModerationAt_1_publishedAt_-1", key: { status: 1, lastModerationAt: 1, publishedAt: -1 } },
  { collection: "listing_versions", name: "listingId_1_version_-1", key: { listingId: 1, version: -1 } },
  { collection: "sessions", name: "userId_1_revokedAt_1", key: { userId: 1, revokedAt: 1 } },
  { collection: "users", name: "status_1_createdAt_-1", key: { status: 1, createdAt: -1 } },
  { collection: "identity_verifications", name: "status_1_createdAt_-1", key: { status: 1, createdAt: -1 } },
  { collection: "payments", name: "status_1_createdAt_-1", key: { status: 1, createdAt: -1 } },
  { collection: "wallet_entries", name: "refType_1_createdAt_-1", key: { refType: 1, createdAt: -1 } },
  { collection: "content_items", name: "kind_1_slug_1", key: { kind: 1, slug: 1 }, options: { unique: true } },
  { collection: "content_items", name: "path_1", key: { path: 1 }, options: { unique: true, sparse: true } },
  { collection: "content_items", name: "kind_1_status_1_publishedAt_-1", key: { kind: 1, status: 1, publishedAt: -1 } },
  { collection: "content_items", name: "status_1_scheduled.at_1", key: { status: 1, "scheduled.at": 1 } },
  { collection: "content_revisions", name: "itemId_1_version_1", key: { itemId: 1, version: 1 }, options: { unique: true } },
];

export async function duplicateVersionPairs(db, limit = 5) {
  return db
    .collection("listing_versions")
    .aggregate([
      { $group: { _id: { listingId: "$listingId", version: "$version" }, n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
      { $limit: limit },
    ])
    .toArray()
    .catch(() => []);
}

/**
 * Lists which of the admin build indexes exist and which are missing. Dry run unless `apply` is true.
 * With apply it creates only the missing ones (createIndex is safe to repeat). Nothing else is read or changed.
 */
export async function syncAdminIndexes(db, { apply = false } = {}) {
  const existingByCollection = new Map();
  for (const wanted of WANTED) {
    if (!existingByCollection.has(wanted.collection)) {
      const found = await db.collection(wanted.collection).indexes().catch(() => []);
      existingByCollection.set(wanted.collection, found.map((index) => index.name));
    }
  }
  const missing = WANTED.filter((wanted) => !existingByCollection.get(wanted.collection).includes(wanted.name));
  const created = [];
  if (apply) {
    for (const wanted of missing) {
      await db.collection(wanted.collection).createIndex(wanted.key, { name: wanted.name, ...(wanted.options ?? {}) });
      created.push(`${wanted.collection}.${wanted.name}`);
    }
  }
  return {
    apply,
    wanted: WANTED.map((item) => `${item.collection}.${item.name}`),
    missing: missing.map((item) => `${item.collection}.${item.name}`),
    created,
    duplicateVersionPairs: await duplicateVersionPairs(db),
  };
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
    const result = await syncAdminIndexes(client.db(), { apply });
    console.log(`SYNC_ADMIN_INDEXES ${apply ? "APPLIED" : "DRY RUN"} ${JSON.stringify(result)}`);
    if (!apply) console.log("Nothing was changed. Run again with --apply to create the missing indexes.");
  } finally {
    await client.close();
  }
}

if ((process.argv[1] ?? "").includes("sync-admin-indexes")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Index sync failed");
    process.exit(1);
  });
}
