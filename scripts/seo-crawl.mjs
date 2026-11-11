const base = (process.env.BASE_URL || process.argv[2] || "").replace(/\/$/, "");
if (!base) {
  console.error("Set BASE_URL");
  process.exit(1);
}

const limit = Number(process.env.SEO_CRAWL_LIMIT || 80);

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function text(url) {
  const response = await fetch(url, { redirect: "follow" });
  return { status: response.status, body: await response.text(), final: response.url };
}

const index = await text(`${base}/sitemap.xml`);
const shards = locs(index.body).filter((url) => url.includes("/sitemap/"));
const pages = [];
for (const shard of shards) {
  const xml = await text(shard);
  pages.push(...locs(xml.body));
}
const sample = pages.slice(0, limit);
const titles = new Map();
const descriptions = new Map();
const failures = [];

for (const url of sample) {
  const page = await text(url);
  const title = (page.body.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
  const description = (page.body.match(/name="description" content="([^"]*)"/i) || [])[1] || "";
  const canonical = (page.body.match(/rel="canonical" href="([^"]*)"/i) || [])[1] || "";
  const robots = (page.body.match(/name="robots" content="([^"]*)"/i) || [])[1] || "";
  const h1 = [...page.body.matchAll(/<h1\b/gi)].length;
  const emptyAlt = [...page.body.matchAll(/<img\b[^>]*>/gi)].filter((tag) => {
    const alt = tag[0].match(/\balt="([^"]*)"/i);
    const hidden = /aria-hidden="true"/i.test(tag[0]);
    return alt && alt[1] === "" && !hidden;
  }).length;
  const noindex = /noindex/i.test(robots);
  const problems = [];
  if (page.status !== 200) problems.push(`status ${page.status}`);
  if (noindex) problems.push("noindex");
  if (!canonical) problems.push("missing canonical");
  if (h1 !== 1) problems.push(`h1 ${h1}`);
  if (!title) problems.push("missing title");
  if (!description) problems.push("missing description");
  if (emptyAlt) problems.push(`empty alt ${emptyAlt}`);
  if (titles.get(title)) problems.push("duplicate title");
  if (description && descriptions.get(description)) problems.push("duplicate description");
  titles.set(title, url);
  if (description) descriptions.set(description, url);
  failures.push({ url, ok: problems.length === 0, problems });
}

const bad = failures.filter((row) => !row.ok);
console.log(`crawled ${sample.length} of ${pages.length} sitemap urls`);
console.log("url\tresult");
for (const row of failures) console.log(`${row.url}\t${row.ok ? "PASS" : row.problems.join(", ")}`);
if (bad.length) process.exit(1);
