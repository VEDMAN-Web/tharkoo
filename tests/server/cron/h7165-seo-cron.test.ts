import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAudit } = vi.hoisted(() => ({ runAudit: vi.fn(async (input: { limit?: number }) => ({ id: "run1", counts: { pages: input.limit ?? 0 } })) }));
vi.mock("@/server/seo/audit-run", async (original) => ({ ...(await original<typeof import("@/server/seo/audit-run")>()), runAudit }));

import * as seoAudit from "@/app/api/cron/seo-audit/route";
import { MANUAL_RUN_LIMIT } from "@/app/admin/seo/overview";
import { NIGHTLY_PAGE_LIMIT } from "@/server/seo/audit-run";

const SECRET = "h7165-test-secret";

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
  runAudit.mockClear();
});

describe("the nightly SEO check (H7.165)", () => {
  it("is called by Vercel Cron with GET and the bearer secret, and opens at most the nightly page limit so it ends inside 300 seconds", async () => {
    const response = await seoAudit.GET(new Request("http://localhost/api/cron/seo-audit", { headers: { authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(200);
    expect(runAudit).toHaveBeenCalledTimes(1);
    expect(runAudit.mock.calls[0][0]).toMatchObject({ triggeredBy: "cron", limit: NIGHTLY_PAGE_LIMIT });
    expect(NIGHTLY_PAGE_LIMIT).toBeGreaterThan(MANUAL_RUN_LIMIT);
    expect(NIGHTLY_PAGE_LIMIT).toBeLessThanOrEqual(1500);
    expect(seoAudit.maxDuration).toBeLessThanOrEqual(300);
  });

  it("refuses a call without the secret and runs nothing", async () => {
    const response = await seoAudit.GET(new Request("http://localhost/api/cron/seo-audit"));
    expect(response.status).toBe(401);
    expect(runAudit).not.toHaveBeenCalled();
  });
});
