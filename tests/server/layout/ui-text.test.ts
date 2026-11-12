import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetUiText, saveUiText, textOverrides, uiTexts } from "@/app/admin/ui-text/store";
import { invalidateTags } from "@/lib/cache";
import { fillText, makeT, TEXT_DEFAULTS, TEXT_KEYS, TEXT_MAX } from "@/lib/ui/text";
import { AuditEvent, UiText } from "@/server/models";
import { textDenied } from "@/server/shared/policy";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

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

describe("TEXT_DEFAULTS", () => {
  it("has a non-empty text, short enough, with no forbidden term, for every key", () => {
    expect(TEXT_KEYS.length).toBeGreaterThan(20);
    for (const key of TEXT_KEYS) {
      const text = TEXT_DEFAULTS[key];
      expect(text.trim().length, key).toBeGreaterThan(0);
      expect(text.length, key).toBeLessThanOrEqual(TEXT_MAX);
      expect(textDenied(text).denied, key).toBe(false);
    }
  });

  it("fills placeholders and leaves unknown ones", () => {
    expect(fillText("{count} ads", { count: 3 })).toBe("3 ads");
    expect(fillText("{a} {b}", { a: "x" })).toBe("x {b}");
    expect(makeT({ "listing.more": "More" })("listing.more")).toBe("More");
    expect(makeT()("listing.more")).toBe(TEXT_DEFAULTS["listing.more"]);
  });
});

describe("ui text store", () => {
  it("returns an override, then the default after a reset", async () => {
    expect((await uiTexts())("listing.more")).toBe("Show more");
    await saveUiText({ ...admin, key: "listing.more", value: "  Load more  " });
    expect((await uiTexts())("listing.more")).toBe("Load more");
    expect(await UiText.countDocuments({ key: "listing.more" })).toBe(1);
    await resetUiText({ ...admin, key: "listing.more" });
    expect((await uiTexts())("listing.more")).toBe("Show more");
    expect(await textOverrides()).toEqual({});
  });

  it("removes the override when the new text equals the default", async () => {
    await saveUiText({ ...admin, key: "listing.more", value: "Load more" });
    await saveUiText({ ...admin, key: "listing.more", value: "Show more" });
    expect(await UiText.countDocuments({})).toBe(0);
  });

  it("refuses more than 160 characters, empty text and unknown keys", async () => {
    await expect(saveUiText({ ...admin, key: "listing.more", value: "x".repeat(161) })).rejects.toThrow(/160/);
    await expect(saveUiText({ ...admin, key: "listing.more", value: "   " })).rejects.toThrow(/empty/i);
    await expect(saveUiText({ ...admin, key: "listing.nope", value: "Hello" })).rejects.toThrow(/unknown/i);
    expect(await saveUiText({ ...admin, key: "listing.more", value: "x".repeat(160) })).toMatchObject({ key: "listing.more" });
  });

  it("refuses forbidden terms and markup", async () => {
    const term = ["es", "cort"].join("");
    await expect(saveUiText({ ...admin, key: "listing.more", value: `Best ${term} here` })).rejects.toThrow(/not allowed/i);
    await expect(saveUiText({ ...admin, key: "listing.more", value: "<b>More</b>" })).rejects.toThrow(/</);
    expect(await UiText.countDocuments({})).toBe(0);
  });

  it("refuses everyone who is not an admin", async () => {
    for (const roles of [["user"], ["moderator"], ["seo_editor"], []]) {
      await expect(saveUiText({ email: "x@example.test", roles, key: "listing.more", value: "More" })).rejects.toThrow(/admin/i);
      await expect(resetUiText({ email: "x@example.test", roles, key: "listing.more" })).rejects.toThrow(/admin/i);
    }
    expect(await AuditEvent.countDocuments({})).toBe(0);
  });

  it("writes one ui_text.update audit event per change, with before and after", async () => {
    await saveUiText({ ...admin, key: "listing.more", value: "Load more" });
    await saveUiText({ ...admin, key: "listing.more", value: "Load even more" });
    await resetUiText({ ...admin, key: "listing.more" });
    await resetUiText({ ...admin, key: "listing.more" });
    const events = await AuditEvent.find({ action: "ui_text.update" }).sort({ createdAt: 1 }).lean();
    expect(events).toHaveLength(3);
    expect(events[0].targetId).toBe("listing.more");
    expect(events[0].before).toEqual({ value: null });
    expect(events[0].after).toEqual({ value: "Load more" });
    expect(events[1].before).toEqual({ value: "Load more" });
    expect(events[2].after).toEqual({ value: null });
  });
});
