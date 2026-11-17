import mongoose from "mongoose";
import { mongoUri } from "../../src/lib/db";
import { runHomeLayoutD1 } from "../../src/server/layout/d1-home";

const LOCAL_URI = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/;

function usage() {
  console.error("Usage: tsx scripts/migrate/d1-home-layout.ts [--dry-run | --apply --yes] [--json]");
  console.error("A dry run (the default) prints the format 2 home blocks and writes nothing.");
  console.error("--apply publishes them as the next home version (note D1). A database that is not local also needs --allow-live.");
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(["--dry-run", "--apply", "--yes", "--json", "--allow-live"]);
  const unknown = args.filter((arg) => !known.has(arg));
  const apply = args.includes("--apply");
  if (unknown.length > 0 || (apply && args.includes("--dry-run"))) {
    usage();
    process.exitCode = 1;
    return;
  }
  if (apply && !args.includes("--yes")) {
    console.error("Refused: --apply needs --yes.");
    process.exitCode = 1;
    return;
  }
  if (apply && !LOCAL_URI.test(mongoUri()) && !args.includes("--allow-live")) {
    console.error("Refused: this database is not local. --apply on a live database needs --allow-live and Vedant's OK.");
    process.exitCode = 1;
    return;
  }
  try {
    const result = await runHomeLayoutD1({ apply });
    if (args.includes("--json")) {
      console.log(JSON.stringify(result));
      return;
    }
    console.log(`D1 ${result.action}: home v${result.fromVersion} (format ${result.fromFormat}) -> v${result.toVersion} (format 2)`);
    if (result.reason) console.log(result.reason);
    console.log(JSON.stringify(result.blocks, null, 2));
    if (result.action === "refused") process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
