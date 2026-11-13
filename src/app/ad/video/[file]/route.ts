import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

/** Serves ad videos stored on local disk (no Cloudinary). Supports Range requests so browsers can seek and Safari can play. */
export async function GET(request: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = path.basename(file);
  if (!/^[a-f0-9]{24}\.(mp4|webm|mov)$/i.test(name)) return new Response("Not found", { status: 404 });
  let data: Buffer;
  try {
    data = await readFile(path.join(process.cwd(), "public", "uploads", name));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = TYPES[name.split(".").pop()!.toLowerCase()] || "application/octet-stream";
  const headers: Record<string, string> = { "content-type": type, "accept-ranges": "bytes", "cache-control": "public, max-age=3600" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "");
  if (!range || (!range[1] && !range[2])) return new Response(new Uint8Array(data), { headers: { ...headers, "content-length": String(data.length) } });
  const start = range[1] ? Number(range[1]) : Math.max(0, data.length - Number(range[2]));
  const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
  if (start > end || start >= data.length) return new Response("Range not satisfiable", { status: 416, headers: { "content-range": `bytes */${data.length}` } });
  const slice = data.subarray(start, end + 1);
  return new Response(new Uint8Array(slice), {
    status: 206,
    headers: { ...headers, "content-length": String(slice.length), "content-range": `bytes ${start}-${end}/${data.length}` },
  });
}
