import { describe, expect, it } from "vitest";
import { GET as aiTxt } from "@/app/ai.txt/route";
import { GET as securityTxt } from "@/app/.well-known/security.txt/route";

describe("H22.1 discovery files", () => {
  it("ai.txt opens public pages and closes private paths and uploaded media", async () => {
    const res = aiTxt();
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toContain("User-Agent: *\nAllow: /");
    for (const path of ["/u/", "/search", "/admin/", "/api/", "/uploads/", "*.jpg", "*.mp4"]) expect(body).toContain(`Disallow: ${path}`);
    expect(body).toMatch(/llms\.txt/);
  });

  it("security.txt has a contact and an expiry about a year ahead (RFC 9116)", async () => {
    const body = await securityTxt().text();
    expect(body).toMatch(/^Contact: mailto:/m);
    const expires = new Date(/^Expires: (.+)$/m.exec(body)?.[1] ?? "");
    const days = (expires.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(370);
    expect(body).toMatch(/^Canonical: https?:\/\/.+\/\.well-known\/security\.txt$/m);
  });
});
