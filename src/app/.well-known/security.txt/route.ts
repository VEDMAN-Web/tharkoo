import { canonical } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** H22.1: RFC 9116 security.txt. Expires is always one year ahead, so the file never goes stale. */
export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const lines = [
    "Contact: mailto:support@tharkoo.com",
    `Contact: ${canonical("/contact/")}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en, hi",
    `Canonical: ${canonical("/.well-known/security.txt")}`,
    `Policy: ${canonical("/terms/")}`,
  ];
  return new Response(lines.join("\n") + "\n", { headers: { "content-type": "text/plain; charset=utf-8" } });
}
