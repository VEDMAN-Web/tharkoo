import { MongoClient } from "mongodb";

export const REF_KEY_INDEX = "refKey_1";

export const REF_KEY_SPEC = { key: { refKey: 1 }, options: { name: REF_KEY_INDEX, unique: true, partialFilterExpression: { refKey: { $type: "string" } } } };

/**
 * Lists the indexes of the wallet collection and, only with `apply`, builds the unique refKey index that makes the
 * posting fee debit and refund once per ad. Rows without a refKey are not part of the index, so existing data is
 * never in the way. Safe to run twice.
 */
export async function ensureWalletRefKeyIndex(db, { apply = false } = {}) {
  const wallet = db.collection("wallet_entries");
  const before = (await wallet.indexes().catch(() => [])).map((index) => index.name);
  const present = before.includes(REF_KEY_INDEX);
  if (!apply || present) return { apply, present, created: false, indexes: before };
  await wallet.createIndex(REF_KEY_SPEC.key, REF_KEY_SPEC.options);
  const after = (await wallet.indexes()).map((index) => index.name);
  return { apply, present, created: true, indexes: after };
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
    const result = await ensureWalletRefKeyIndex(client.db(), { apply });
    console.log(JSON.stringify(result, null, 2));
    if (!apply && !result.present) console.log("Dry run. Run again with --apply to build the index.");
  } finally {
    await client.close();
  }
}

if ((process.argv[1] ?? "").includes("ensure-wallet-index")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Index check failed");
    process.exit(1);
  });
}
