import { canonical } from "@/lib/seo";

const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function queueIndexNow(paths: string[]) {
  const key = process.env.INDEXNOW_KEY;
  const host = process.env.INDEXNOW_HOST || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!key || !host) return;
  for (const path of paths) {
    if (path) pending.add(path.startsWith("http") ? path : canonical(path));
  }
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    const urls = [...pending];
    pending.clear();
    void postIndexNow(urls).catch(() => undefined);
  }, 1500);
  timer.unref?.();
}

export async function postIndexNow(urls: string[], fetchImpl: typeof fetch = fetch) {
  const key = process.env.INDEXNOW_KEY;
  const hostRaw = process.env.INDEXNOW_HOST || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!key || !hostRaw || urls.length === 0) return { sent: false, count: 0 };
  const host = hostRaw.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const body = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: urls.slice(0, 10000),
  };
  const response = await fetchImpl("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return { sent: response.ok, count: body.urlList.length };
}
