import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { homeFromLayoutOn } from "@/lib/layout/home-read";
import { loadHomeBuilder, setHomeSwitch } from "@/server/layout/home-builder";
import { AuditEvent, PageLayout, PageLayoutRevision, Site } from "@/server/models";
import { seedHomeLayout } from "@/server/seed/layouts";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";
import { seedLegacyHome } from "./a19-legacy-home";

const admin: AdminCtx = { actorId: new mongoose.Types.ObjectId().toString(), email: "admin@example.test", roles: ["admin"], requestId: "req" };
const moderator: AdminCtx = { ...admin, roles: ["moderator"] };

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await PageLayout.init();
  await PageLayoutRevision.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("the Home switch in the Page builder (H7.147)", () => {
  it("is off by default, and the builder says so", async () => {
    expect(await homeFromLayoutOn()).toBe(false);
    expect((await loadHomeBuilder(admin)).switchOn).toBe(false);
  });

  it("cannot be turned on without a published format 2 version, and nothing changes", async () => {
    await expect(setHomeSwitch(admin, { on: true })).rejects.toBeInstanceOf(ValidationError);
    await seedLegacyHome();
    await expect(setHomeSwitch(admin, { on: true })).rejects.toThrow(/Publish a Home version/);
    expect(await homeFromLayoutOn()).toBe(false);
    expect(await AuditEvent.countDocuments({ action: "settings.home_from_layout.update" })).toBe(0);
  });

  it("is for admins only", async () => {
    await seedHomeLayout();
    await expect(setHomeSwitch(moderator, { on: true })).rejects.toBeInstanceOf(ForbiddenError);
    expect(await homeFromLayoutOn()).toBe(false);
  });

  it("turns on when a format 2 version is published, with one audit line that names the version", async () => {
    await seedHomeLayout();
    const done = await setHomeSwitch(admin, { on: true });
    expect(done).toMatchObject({ on: true, version: 1, changed: true, canUndo: true });
    expect(await homeFromLayoutOn()).toBe(true);
    expect((await loadHomeBuilder(admin)).switchOn).toBe(true);
    const rows = await AuditEvent.find({ action: "settings.home_from_layout.update" }).lean<{ summary: string; undo?: { kind: string } }[]>();
    expect(rows).toHaveLength(1);
    expect(rows[0].summary).toBe("Turned on drawing the Home page from the Page builder (version 1)");
    expect(rows[0].undo?.kind).toBe("record.restore");
  });

  it("Undo turns it off again from the saved value, and undoing the undo turns it back on", async () => {
    await seedHomeLayout();
    const on = await setHomeSwitch(admin, { on: true });
    const undone = await undoEvent(admin, on.eventId);
    expect(undone.ok).toBe(true);
    expect(await homeFromLayoutOn()).toBe(false);
    expect((await Site.findOne({ key: "default" }).lean<{ homeFromLayout?: boolean }>())?.homeFromLayout).not.toBe(true);
    if (!undone.ok) return;
    const redone = await undoEvent(admin, undone.eventId);
    expect(redone.ok).toBe(true);
    expect(await homeFromLayoutOn()).toBe(true);
  });

  it("turning it off always works, can be undone, and does nothing when it is already off", async () => {
    await seedHomeLayout();
    expect(await setHomeSwitch(admin, { on: false })).toMatchObject({ changed: false, canUndo: false });
    expect(await AuditEvent.countDocuments({ action: "settings.home_from_layout.update" })).toBe(0);
    await setHomeSwitch(admin, { on: true });
    await PageLayout.updateOne({ key: "home", scope: "default" }, { $set: { format: 1 } });
    const off = await setHomeSwitch(admin, { on: false });
    expect(off).toMatchObject({ on: false, changed: true });
    expect(await homeFromLayoutOn()).toBe(false);
    const back = await undoEvent(admin, off.eventId);
    expect(back.ok).toBe(true);
    expect(await homeFromLayoutOn()).toBe(true);
  });
});
