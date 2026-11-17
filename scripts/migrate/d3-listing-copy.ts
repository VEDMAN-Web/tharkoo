import mongoose from "mongoose";
import { mongoUri } from "../../src/lib/db";
import { applyListingCopyMigration, planListingCopyMigration } from "../../src/server/content/d3-listing-copy";

const LOCAL_URI = /^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/;

function usage() {
  console.error("Usage: tsx scripts/migrate/d3-listing-copy.ts [--dry-run | --apply --yes] [--json]");
  console.error("A dry run (the default) lists, for every listing page with saved copy, each source, the one that wins today and the record it would write. It writes nothing.");
  console.error("--apply writes the records as published listing text. A database that is not local also needs --allow-live.");
}

async function main() {
  const args = process.argv.slice(2);
  const known = new Set(["--dry-run", "--apply", "--yes", "--json", "--allow-live"]);
  const apply = args.includes("--apply");
  if (args.some((arg) => !known.has(arg)) || (apply && args.includes("--dry-run"))) {
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
    const plan = await planListingCopyMigration();
    const result = apply ? await applyListingCopyMigration(plan) : null;
    if (args.includes("--json")) {
      console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", ...(result ?? {}), plan }));
      return;
    }
    console.log(`D3 ${apply ? "applied" : "dry run"}: ${plan.totals.urls} pages, ${plan.totals.new} new, ${plan.totals.exists} already there, ${plan.totals.nothing} with nothing to copy, ${plan.totals.conflicts} with conflicts`);
    if (result) console.log(`Written: ${result.written}`);
    console.log(`Not listing pages or not covered: ${plan.skipped.length}. Site.landings keys with no matching page: ${plan.unmapped.length}. Unused old fields: ${plan.dead.categories} categories, ${plan.dead.locations} places.`);
    console.log(JSON.stringify(plan.entries, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
