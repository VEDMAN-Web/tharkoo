import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ownership = JSON.parse(readFileSync("docs/ownership.json", "utf8"));

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function hasRef(ref) {
  try {
    execSync(`git rev-parse --verify ${ref}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function branchName() {
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF;
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  return sh("git rev-parse --abbrev-ref HEAD");
}

function globToRegExp(glob) {
  const source = glob.replace(/\\/g, "/").replace(/^\.\//, "");
  let re = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "*") {
      if (source[i + 1] === "*") {
        if (source[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (".+?^${}()|[]\\".includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

function matches(file, patterns) {
  return patterns.some((pattern) => globToRegExp(pattern).test(file));
}

function changedFiles(base) {
  const out = sh(
    `git -c core.quotepath=false diff --name-status ${base}...HEAD`,
  );
  const files = new Set();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t").slice(1);
    for (const file of parts) files.add(file.replace(/\\/g, "/"));
  }
  return [...files];
}

const branch = branchName();
if (branch === "main") {
  console.log("ownership-check: skipped on main");
  process.exit(0);
}

const match = branch.match(/^(?:(?:cursor|codex)\/(t)|haiku\/(h))(\d+)\.(\d+)([a-z])?(?:-|$)/);
if (!match) {
  console.error(
    `ownership-check: branch '${branch}' does not match cursor/t*, codex/t* or haiku/h*`,
  );
  process.exit(1);
}

const taskId = `${(match[1] || match[2]).toUpperCase()}${match[3]}.${match[4]}${match[5] ?? ""}`;
const task = ownership.tasks[taskId];
if (!task) {
  console.error(`ownership-check: no docs/ownership.json entry for ${taskId}`);
  process.exit(1);
}
if (task.branchPrefix && !branch.startsWith(task.branchPrefix)) {
  console.error(
    `ownership-check: ${branch} does not start with ${task.branchPrefix}`,
  );
  process.exit(1);
}

let base = process.env.OWNERSHIP_BASE;
if (!base) {
  if (!hasRef("origin/main")) {
    try {
      execSync("git fetch origin main", { stdio: "inherit" });
    } catch {
      /* try local main next */
    }
  }
  base = hasRef("origin/main") ? "origin/main" : "main";
}
if (!hasRef(base)) {
  console.error(`ownership-check: base ref ${base} not found`);
  process.exit(1);
}

const allowed = task.globs ?? [];
const excluded = task.exclude ?? [];
const progressOk = new Set([
  `progress/${taskId}.md`,
  `progress/${taskId.toLowerCase()}.md`,
  "docs/claude/STATUS.md",
]);

const outside = [];
for (const file of changedFiles(base)) {
  if (progressOk.has(file) || file.startsWith("docs/claude/")) continue;
  if (matches(file, excluded) || !matches(file, allowed)) outside.push(file);
}

if (outside.length) {
  console.error(
    `ownership-check: ${taskId} (${branch}) touched paths outside its globs:`,
  );
  for (const file of outside) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`ownership-check: ${taskId} ok (${changedFiles(base).length} files)`);
