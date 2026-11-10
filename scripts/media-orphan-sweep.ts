import mongoose from "mongoose";
import { sweepOrphans } from "../src/server/media/service";

export function dryRunRequested(argv: string[]) {
  return argv.includes("--dry-run");
}

async function main() {
  const dryRun = dryRunRequested(process.argv);
  try {
    const result = await sweepOrphans({ dryRun });
    console.log(`MEDIA_ORPHAN_SWEEP ${JSON.stringify(result)}`);
  } finally {
    await mongoose.disconnect();
  }
}

const entry = process.argv[1] ?? "";
if (entry.includes("media-orphan-sweep")) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Media orphan sweep failed");
    process.exit(1);
  });
}
