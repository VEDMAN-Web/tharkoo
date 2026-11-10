import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { dryRunSeed, formatDryRun, rollbackSeed, runSeed, SEED_BATCH } from "../src/server/seed/run";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rollback = process.argv.includes("--rollback");
  await connectDb();
  try {
    if (dryRun && rollback) {
      console.error("Pass only one of --dry-run or --rollback");
      process.exitCode = 1;
      return;
    }
    if (dryRun) {
      console.log(formatDryRun(await dryRunSeed()));
      return;
    }
    if (rollback) {
      const flag = process.argv.indexOf("--batch");
      const batch = flag >= 0 ? process.argv[flag + 1] : SEED_BATCH;
      if (!batch) {
        console.error("Usage: seed:rollback [--batch seed-YYYY-MM-DD]");
        process.exitCode = 1;
        return;
      }
      const result = await rollbackSeed(batch);
      console.log(`SEED_ROLLBACK ${JSON.stringify(result)}`);
      if ("refused" in result) process.exitCode = 1;
      return;
    }
    console.log(`SEED_RESULT ${JSON.stringify(await runSeed())}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
