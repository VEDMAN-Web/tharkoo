#!/usr/bin/env node
// Relay between the Tharkoo build chat (Haiku) and the planning chat (Opus).
// Both chats read and write plain files in .relay/ (git-ignored, never pushed).
//
//   node scripts/relay-wait.mjs H1.1          wait for Opus's reply to task H1.1, print it, exit 0
//   node scripts/relay-wait.mjs any           wait for any new Opus message, print it, exit 0
//   node scripts/relay-wait.mjs last          print the newest Opus message now and exit
// Options (env): RELAY_TIMEOUT_MIN (default 120), RELAY_POLL_SEC (default 20).
// Exit codes: 0 = message printed, 2 = timed out (start it again), 1 = usage error.
//
// Message format in .relay/to-haiku.md (Opus appends; newest last):
//   === MESSAGE FOR HAIKU #<n> ===
//   Reply-to: <task id or "none">
//   ...
//   === END MESSAGE ===

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = ".relay";
const INBOX = `${DIR}/to-haiku.md`;
const SEEN = `${DIR}/.haiku-seen`;
const want = (process.argv[2] || "").trim();
if (!want) {
  console.error("usage: node scripts/relay-wait.mjs <TASK-ID|any|last>");
  process.exit(1);
}
const timeoutMs = Number(process.env.RELAY_TIMEOUT_MIN || 120) * 60_000;
const pollMs = Number(process.env.RELAY_POLL_SEC || 20) * 1000;

mkdirSync(DIR, { recursive: true });
if (!existsSync(INBOX)) writeFileSync(INBOX, "");

function messages() {
  const text = readFileSync(INBOX, "utf8").replace(/\r\n/g, "\n");
  const out = [];
  for (const m of text.matchAll(/=== MESSAGE FOR HAIKU #(\d+) ===\n([\s\S]*?)=== END MESSAGE ===/g)) {
    const reply = (m[2].match(/^Reply-to:\s*(.+)$/m) || [])[1]?.trim() || "none";
    out.push({ n: Number(m[1]), reply, body: m[0] });
  }
  return out;
}
const seen = () => (existsSync(SEEN) ? Number(readFileSync(SEEN, "utf8")) || 0 : 0);

if (want === "last") {
  const all = messages();
  console.log(all.length ? all[all.length - 1].body : "No Opus messages yet.");
  process.exit(0);
}

const started = Date.now();
for (;;) {
  // Deliver every new Opus message in order (oldest unseen first), whatever task it replies to.
  const hit = messages().filter((m) => m.n > seen())[0];
  if (hit) {
    writeFileSync(SEEN, String(hit.n));
    console.log(hit.body);
    process.exit(0);
  }
  if (Date.now() - started > timeoutMs) {
    console.log(`No reply from Opus for ${want} yet (waited ${Math.round(timeoutMs / 60000)} min). Run this command again to keep waiting.`);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, pollMs));
}
