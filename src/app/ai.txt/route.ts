import { canonical } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * H22.1: ai.txt (Spawning format). Public text pages may be read and used by AI tools. Photos and videos people upload
 * are theirs, so they are not offered for AI training. Private areas are closed to everyone, as in robots.txt.
 */
export function GET() {
  const lines = [
    "# Tharkoo ai.txt",
    `# Guide for AI tools: ${canonical("/llms.txt")}`,
    `# Crawl rules: ${canonical("/robots.txt")}`,
    "",
    "User-Agent: *",
    "Allow: /",
    "Disallow: /u/",
    "Disallow: /search",
    "Disallow: /admin/",
    "Disallow: /api/",
    "Disallow: /uploads/",
    "Disallow: *.jpg",
    "Disallow: *.jpeg",
    "Disallow: *.png",
    "Disallow: *.webp",
    "Disallow: *.gif",
    "Disallow: *.mp4",
    "Disallow: *.webm",
    "Disallow: *.mov",
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
