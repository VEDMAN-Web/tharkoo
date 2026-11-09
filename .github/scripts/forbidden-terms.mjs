import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const TEXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".json",
  ".md",
  ".txt",
  ".css",
  ".html",
  ".svg",
  ".yml",
  ".yaml",
]);
const SKIP_DIRS = new Set(["node_modules", ".next", "graphify-out"]);
const ROOTS = ["src", "scripts", "public"];
const LIST = ".github/forbidden-terms.txt";

const terms = readFileSync(LIST, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));
const rules = terms.map((term) => ({ term, re: new RegExp(term, "i") }));

function walk(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name).replace(/\\/g, "/");
    if (path === "docs/prd" || path.startsWith("docs/prd/") || path === LIST) {
      continue;
    }
    const st = statSync(path);
    if (st.isDirectory()) walk(path, files);
    else if (TEXT.has(extname(name).toLowerCase())) files.push(path);
  }
}

const files = [];
for (const root of ROOTS) walk(root, files);

const hits = [];
for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        hits.push(`${file}:${index + 1}: ${rule.term}`);
      }
    }
  });
}

const warnOnly = process.env.FORBIDDEN_WARN_ONLY === "true";
if (hits.length === 0) {
  console.log(`forbidden-terms: 0 hits in ${files.length} files`);
  process.exit(0);
}

const mode = warnOnly ? "WARN" : "FAIL";
console.error(`forbidden-terms: ${mode} ${hits.length} hit(s)`);
for (const hit of hits) console.error(hit);
process.exit(warnOnly ? 0 : 1);
