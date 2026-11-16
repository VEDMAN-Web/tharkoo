import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function stringList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function checkEntry(file, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return [`${file}: must be a JSON object`];
  }
  const problems = [];
  if (typeof entry.branchPrefix !== "string") {
    problems.push(`${file}: branchPrefix must be a string`);
  }
  if (!stringList(entry.globs)) {
    problems.push(`${file}: globs must be an array of strings`);
  }
  if (entry.exclude !== undefined && !stringList(entry.exclude)) {
    problems.push(`${file}: exclude must be an array of strings`);
  }
  return problems;
}

export function loadOwnership(dir) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
  const tasks = {};
  const seen = new Map();
  const problems = [];
  for (const file of files) {
    const taskId = file.slice(0, -".json".length);
    const key = taskId.toLowerCase();
    if (seen.has(key)) {
      problems.push(`${file}: duplicate task id ${taskId} (already defined by ${seen.get(key)})`);
      continue;
    }
    seen.set(key, file);
    let entry;
    try {
      entry = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch (error) {
      problems.push(`${file}: invalid JSON (${error.message})`);
      continue;
    }
    const entryProblems = checkEntry(file, entry);
    if (entryProblems.length) {
      problems.push(...entryProblems);
      continue;
    }
    tasks[taskId] = entry;
  }
  if (problems.length) {
    throw new Error(`docs/ownership has ${problems.length} problem(s):\n${problems.join("\n")}`);
  }
  return { tasks };
}
