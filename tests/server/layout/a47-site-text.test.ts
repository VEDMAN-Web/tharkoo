import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetUiTextAs, saveUiTextAs, textOverrides } from "@/app/admin/ui-text/store";
import { invalidateTags } from "@/lib/cache";
import { TEXT_DEFAULTS, TEXT_KEYS } from "@/lib/ui/text";
import { areaOf, groupedTextKeys, TEXT_AREAS, textLabel, textWhere } from "@/lib/ui/text-labels";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { ForbiddenError, ValidationError } from "@/server/http";
import { AuditEvent, UiText } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ctx = (roles: string[]): AdminCtx => ({ actorId: String(new mongoose.Types.ObjectId()), email: "admin@example.test", roles, requestId: "r" });
const admin = ctx(["admin"]);

beforeAll(async () => {
  await connectMemoryMongo();
  await UiText.init();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["layout:text"]);
});
afterAll(async () => {
  await disconnectMemoryMongo();
});

describe("plain names for every word of the site", () => {
  it("gives every key an area, a plain name and a place, and never shows a developer key", () => {
    const seen = new Map<string, string>();
    for (const key of TEXT_KEYS) {
      const label = textLabel(key);
      expect(label.length, key).toBeGreaterThan(1);
      expect(label, key).not.toMatch(/[._{}\[\]]|[a-z][A-Z]/);
      expect(label, key).not.toBe(key);
      expect(textWhere(key).length, key).toBeGreaterThan(3);
      expect(TEXT_AREAS.some((area) => area.id === areaOf(key).id), key).toBe(true);
      const id = `${areaOf(key).id}|${textWhere(key)}|${label}`;
      expect(seen.get(id), `${key} and ${seen.get(id)} read the same`).toBeUndefined();
      seen.set(id, key);
    }
  });

  it("puts every key in exactly one area, in order", () => {
    const groups = groupedTextKeys();
    expect(groups.flatMap((group) => group.rows.map((row) => row.key)).sort()).toEqual([...TEXT_KEYS].sort());
    expect(groups.map((group) => group.area.id)).toEqual(TEXT_AREAS.filter((area) => groups.some((group) => group.area.id === area.id)).map((area) => area.id));
  });

  it("reads like plain words", () => {
    expect(textLabel("home.search.allStates")).toBe("Search all states");
    expect(textWhere("home.search.allStates")).toBe("Home page, search box");
    expect(areaOf("recharge.title").label).toBe("Credits and payments");
    expect(areaOf("post.field.title").label).toBe("Post your ad");
  });
});

describe("saving site text through the write helper", () => {
  it("saves with one audit row, and Undo puts the old text back", async () => {
    const done = await saveUiTextAs(admin, { key: "listing.more", value: "  Load more  " });
    expect(done.value).toBe("Load more");
    expect((await textOverrides())["listing.more"]).toBe("Load more");
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "ui_text.update", targetId: "listing.more", before: { value: null }, after: { value: "Load more" }, undo: { kind: "record.restore" } });
    expect(await undoEvent(admin, done.eventId)).toMatchObject({ ok: true });
    invalidateTags(["layout:text"]);
    expect((await textOverrides())["listing.more"] ?? TEXT_DEFAULTS["listing.more"]).toBe(TEXT_DEFAULTS["listing.more"]);
  });

  it("undoes a second change back to the first text and refuses when it changed since", async () => {
    await saveUiTextAs(admin, { key: "listing.more", value: "First" });
    const second = await saveUiTextAs(admin, { key: "listing.more", value: "Second" });
    await saveUiTextAs(admin, { key: "listing.more", value: "Third" });
    expect(await undoEvent(admin, second.eventId)).toMatchObject({ ok: false, reason: "conflict" });
    expect((await textOverrides())["listing.more"]).toBe("Third");
  });

  it("a text equal to the default removes the override, and a reset needs no undo", async () => {
    await saveUiTextAs(admin, { key: "listing.more", value: "Load more" });
    const back = await saveUiTextAs(admin, { key: "listing.more", value: TEXT_DEFAULTS["listing.more"] });
    expect(await UiText.countDocuments({})).toBe(0);
    expect(await AuditEvent.findById(back.eventId).lean()).toMatchObject({ after: { value: null } });
    await saveUiTextAs(admin, { key: "listing.more", value: "Load again" });
    const reset = await resetUiTextAs(admin, "listing.more");
    expect(reset.value).toBe(TEXT_DEFAULTS["listing.more"]);
    expect(await UiText.countDocuments({})).toBe(0);
  });

  it("refuses long, empty, unknown, marked up and forbidden text, and anyone who is not an admin", async () => {
    await expect(saveUiTextAs(admin, { key: "listing.more", value: "x".repeat(161) })).rejects.toThrow(/160/);
    await expect(saveUiTextAs(admin, { key: "listing.more", value: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveUiTextAs(admin, { key: "listing.nope", value: "Hello" })).rejects.toThrow(/unknown/i);
    await expect(saveUiTextAs(admin, { key: "listing.more", value: "<b>More</b>" })).rejects.toThrow(/</);
    for (const roles of [["user"], ["moderator"], ["seo_editor"], ["support"]]) {
      await expect(saveUiTextAs(ctx(roles), { key: "listing.more", value: "More" })).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await UiText.countDocuments({})).toBe(0);
    expect(await AuditEvent.countDocuments({ action: "admin.write.denied" })).toBe(4);
  });
});
