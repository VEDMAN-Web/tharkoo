import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertNoDashes, dashFields, DASH_CHARS, DASH_MESSAGE } from "@/server/content/dashes";
import { repairDashes } from "@/server/content/dash-repair";
import { Category } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

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

describe("dashes in admin text", () => {
  it("detects both an em dash and an en dash, and nothing else", () => {
    expect(DASH_CHARS.test(`a ${EM} b`)).toBe(true);
    expect(DASH_CHARS.test(`a ${EN} b`)).toBe(true);
    expect(DASH_CHARS.test("a | b, c: d.")).toBe(false);
  });

  it("names the fields that contain a dash and refuses them with the clear message", () => {
    expect(dashFields({ seoTitle: `x ${EM} y`, seoDescription: "plain", h1: `z ${EN} w` })).toEqual(["seoTitle", "h1"]);
    let caught: { fields?: Record<string, string[]> } | undefined;
    try {
      assertNoDashes({ seoTitle: `x ${EM} y` });
    } catch (error) {
      caught = error as { fields?: Record<string, string[]> };
    }
    expect(caught?.fields?.seoTitle).toEqual([DASH_MESSAGE]);
    expect(() => assertNoDashes({ seoTitle: "x | y" })).not.toThrow();
  });
});

describe("stored dashes are repaired, idempotently", () => {
  it("replaces dashes in titles with a pipe and in body text with a comma, and a second run changes nothing", async () => {
    await Category.collection.insertOne({
      slug: "cars",
      name: `Cars ${EM} used`,
      seoTitle: `Tharkoo ${EM} Free classifieds in India`,
      introHtml: `Buy and sell ${EN} locally`,
      fields: [],
      enabled: true,
    });
    const first = await repairDashes("req-dash-1");
    expect(first.updated).toBe(1);
    const row = await Category.collection.findOne({ slug: "cars" });
    expect(row?.name).toBe("Cars | used");
    expect(row?.seoTitle).toBe("Tharkoo | Free classifieds in India");
    expect(row?.introHtml).toBe("Buy and sell, locally");
    const second = await repairDashes("req-dash-2");
    expect(second.updated).toBe(0);
  });
});

describe("repair keeps database types intact", () => {
  it("does not turn an ObjectId reference into a plain object", async () => {
    const parent = new mongoose.Types.ObjectId();
    await Category.collection.insertOne({ slug: "child", name: `Child ${EM} thing`, parentId: parent, fields: [], enabled: true });
    await repairDashes("req-dash-3");
    const row = await Category.collection.findOne({ slug: "child" });
    expect(row?.parentId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(row?.parentId)).toBe(String(parent));
  });
});
