import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Serves photos written at runtime when Cloudinary is not configured. */
export async function GET(_request: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = path.basename(file);
  if (!/^[a-f0-9]{24}\.(png|jpe?g|webp)$/i.test(name)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(process.cwd(), "public", "uploads", name));
    const ext = name.split(".").pop()?.toLowerCase() || "png";
    return new Response(data, {
      headers: {
        "content-type": TYPES[ext] || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
