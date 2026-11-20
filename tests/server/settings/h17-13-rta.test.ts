import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent } from "@/server/models";
import { RTA_LABEL_VALUE, readRtaLabel, saveRtaLabel } from "@/server/settings/rta-label";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H17.13: the RTA label (meta tag and footer badge) is a Site setting: default ON, switchable off, audited, undoable. */

const ctx = (roles: string[]): AdminCtx => ({ actorId: "000000000000000000000071", email: "boss@example.test", roles, requestId: "req-rta" });
const admin = ctx(["admin"]);

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("the RTA label setting", () => {
  it("is the registered RTA value", () => {
    expect(RTA_LABEL_VALUE).toBe("RTA-5042-1996-1400-1577-RTA");
  });

  it("is ON by default", async () => {
    expect(await readRtaLabel()).toBe(true);
  });

  it("an admin turns it off and on, each change audited with before and after", async () => {
    const off = await saveRtaLabel(admin, { on: false });
    expect(off.on).toBe(false);
    expect(await readRtaLabel()).toBe(false);
    await saveRtaLabel(admin, { on: true });
    expect(await readRtaLabel()).toBe(true);
    const events = await AuditEvent.find({ action: "settings.rta_label" }).sort({ createdAt: 1 }).lean<{ before?: unknown; after?: unknown }[]>();
    expect(events).toHaveLength(2);
    expect(JSON.stringify(events[0]?.before)).toContain("true");
    expect(JSON.stringify(events[0]?.after)).toContain("false");
  });

  it("Undo puts it back as it was", async () => {
    const off = await saveRtaLabel(admin, { on: false });
    expect(await readRtaLabel()).toBe(false);
    expect((await undoEvent(admin, off.eventId)).ok).toBe(true);
    expect(await readRtaLabel()).toBe(true);
  });

  it("refuses a value that is not On or Off, and a person without the settings permission", async () => {
    await expect(saveRtaLabel(admin, { on: "maybe" })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveRtaLabel(ctx(["support"]), { on: false })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await readRtaLabel()).toBe(true);
  });
});
