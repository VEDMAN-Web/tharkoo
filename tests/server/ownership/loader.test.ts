import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadOwnership } from "../../../.github/scripts/ownership-loader.mjs";

let dir = "";

function isCaseInsensitiveFs() {
  const probe = mkdtempSync(join(tmpdir(), "ownership-case-"));
  writeFileSync(join(probe, "a.json"), "{}");
  writeFileSync(join(probe, "A.json"), "{}");
  const count = readdirSync(probe).length;
  rmSync(probe, { recursive: true, force: true });
  return count === 1;
}

const caseInsensitiveFs = isCaseInsensitiveFs();

function put(name: string, body: unknown) {
  writeFileSync(join(dir, name), typeof body === "string" ? body : JSON.stringify(body));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ownership-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadOwnership", () => {
  it("returns the union of every task file keyed by file name", () => {
    put("H1.1.json", { branchPrefix: "haiku/h1.1", globs: ["src/a.ts"] });
    put("H1.2.json", { branchPrefix: "haiku/h1.2", globs: ["src/b.ts"], exclude: ["src/b.test.ts"] });
    put("notes.txt", "ignored");

    const { tasks } = loadOwnership(dir);

    expect(Object.keys(tasks).sort()).toEqual(["H1.1", "H1.2"]);
    expect(tasks["H1.2"].exclude).toEqual(["src/b.test.ts"]);
  });

  it("reports the file name when a file is not valid JSON", () => {
    put("H1.1.json", { branchPrefix: "haiku/h1.1", globs: [] });
    put("H1.2.json", "{ not json");

    expect(() => loadOwnership(dir)).toThrow(/H1\.2\.json: invalid JSON/);
  });

  it.skipIf(caseInsensitiveFs)("reports duplicate task ids that differ only by case", () => {
    put("H1.1.json", { branchPrefix: "haiku/h1.1", globs: [] });
    put("h1.1.json", { branchPrefix: "haiku/h1.1", globs: [] });

    expect(() => loadOwnership(dir)).toThrow(/duplicate task id .*H1\.1/);
  });

  it("reports entries with a missing or malformed shape", () => {
    put("H1.1.json", { globs: ["src/a.ts"] });
    put("H1.2.json", { branchPrefix: "haiku/h1.2", globs: "src/b.ts" });
    put("H1.3.json", [1]);

    expect(() => loadOwnership(dir)).toThrow(
      /H1\.1\.json: branchPrefix[\s\S]*H1\.2\.json: globs[\s\S]*H1\.3\.json: must be a JSON object/,
    );
  });

  it("accepts the empty branchPrefix and globs used by retired tasks", () => {
    put("T9.2.json", { branchPrefix: "", globs: [] });

    expect(loadOwnership(dir).tasks["T9.2"]).toEqual({ branchPrefix: "", globs: [] });
  });

  it("loads the repository's own docs/ownership folder", () => {
    const { tasks } = loadOwnership(join(process.cwd(), "docs", "ownership"));

    expect(tasks["H7.50"].branchPrefix).toBe("haiku/h7.50");
    expect(Object.keys(tasks).length).toBeGreaterThan(150);
  });
});
