import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GONE = ["templates", "translations", "analytics", "media-review", "packs", "products", "slots", "admins", "audit"];
const SRC = join(process.cwd(), "src");

function files(dir: string, out: string[] = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("dead JSON admin screens are gone", () => {
  it("has no folder for any of the nine screens", () => {
    for (const name of GONE) expect(existsSync(join(SRC, "app", "admin", name)), name).toBe(false);
  });

  it("is imported nowhere", () => {
    const hits: string[] = [];
    for (const file of files(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const name of GONE) if (text.includes(`@/app/admin/${name}/`) || text.includes(`app/admin/${name}"`)) hits.push(`${file}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it("is linked from no page or component (only the legacy route table may still name a path)", () => {
    const hits: string[] = [];
    for (const file of files(SRC)) {
      if (file.endsWith(join("lib", "admin", "screens.ts"))) continue;
      const text = readFileSync(file, "utf8");
      for (const name of GONE) if (new RegExp(`["'\`]/admin/${name}/?["'\`]`).test(text)) hits.push(`${file}: ${name}`);
    }
    expect(hits).toEqual([]);
  });
});
