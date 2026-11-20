import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent } from "@/server/models";
import { readGoogleAnalyticsId, saveGoogleAnalyticsId } from "@/server/settings/analytics";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H17.11: the Google Analytics ID is an admin setting; default empty (no tag); strict shape; audited; staff without the permission cannot set it. */

const ctx = (roles: string[]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "boss@example.test", roles, requestId: "req-ga" });

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("the Google Analytics ID setting", () => {
  it("is empty by default, so there is no tag", async () => {
    expect(await readGoogleAnalyticsId()).toBe("");
  });

  it("an admin sets it, it reads back, and the change is in the audit log with before and after", async () => {
    const done = await saveGoogleAnalyticsId(ctx(["admin"]), { id: " g-trcwryjsz1 " });
    expect(done.id).toBe("G-TRCWRYJSZ1");
    expect(await readGoogleAnalyticsId()).toBe("G-TRCWRYJSZ1");
    const event = await AuditEvent.findOne({ action: "settings.google_analytics" }).lean<{ before?: unknown; after?: unknown } | null>();
    expect(event).toBeTruthy();
    expect(JSON.stringify(event?.before)).toContain('"googleAnalyticsId":""');
    expect(JSON.stringify(event?.after)).toContain("G-TRCWRYJSZ1");
  });

  it("an empty value turns the tag off again", async () => {
    await saveGoogleAnalyticsId(ctx(["admin"]), { id: "G-TRCWRYJSZ1" });
    await saveGoogleAnalyticsId(ctx(["admin"]), { id: "" });
    expect(await readGoogleAnalyticsId()).toBe("");
  });

  it("anything that is not a measurement ID is refused and nothing is stored", async () => {
    for (const bad of ["UA-1234-1", "hello world", "G-1';alert(1)", "https://example.test", "G-"]) {
      await expect(saveGoogleAnalyticsId(ctx(["admin"]), { id: bad }), bad).rejects.toBeInstanceOf(ValidationError);
    }
    expect(await readGoogleAnalyticsId()).toBe("");
  });

  it("a person without the settings permission cannot set it", async () => {
    await expect(saveGoogleAnalyticsId(ctx(["support"]), { id: "G-TRCWRYJSZ1" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await readGoogleAnalyticsId()).toBe("");
  });
});
