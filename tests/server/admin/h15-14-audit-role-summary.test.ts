import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { invalidateTags } from "@/lib/cache";
import { createCategory, createSubcategory, deleteCategory, updateCategory } from "@/server/categories/manage";
import { createPlace, deletePlace, updatePlace } from "@/server/locations/manage";
import { deleteTemplate, saveTemplate } from "@/server/seo/templates";
import { AuditEvent, Location } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "boss@example.test", roles: ["admin"] };
const seo = { email: "seo@example.test", roles: ["seo_editor"] };

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
  invalidateTags(["categories", "locations", "listings"]);
});

async function lastEntry(action: string) {
  return AuditEvent.findOne({ action }).sort({ createdAt: -1 }).lean();
}

function expectWhoWhatWhen(row: Awaited<ReturnType<typeof lastEntry>>, role: string, words: RegExp) {
  expect(row, "an audit entry was written").toBeTruthy();
  expect(row?.actorRole).toBe(role);
  expect(row?.summary ?? "").toMatch(words);
  expect(row?.targetLabel ?? "").not.toBe("");
  expect(row?.createdAt).toBeInstanceOf(Date);
}

describe("H15.14 city, category and SEO-template writes say who (role), what (a sentence) and when", () => {
  it("cities and areas: add, change and remove a place", async () => {
    const state = await Location.create({ type: "state", slug: "gujarat", name: "Gujarat", enabled: true, order: 0 });
    const added = await createPlace(admin, { type: "city", parentId: String(state._id), name: "Navsari" });
    const create = await lastEntry("location.create");
    expectWhoWhatWhen(create, "admin", /Added the city "Navsari"/);
    await updatePlace(admin, added.id, { name: "Navsari City", order: 4 });
    expectWhoWhatWhen(await lastEntry("location.update"), "admin", /Changed the city "Navsari City": .*name/);
    await deletePlace(admin, added.id);
    expectWhoWhatWhen(await lastEntry("location.delete"), "admin", /Removed the city "Navsari City"/);
  });

  it("categories and sub-categories: add, change and remove", async () => {
    const made = await createCategory(admin, { name: "Gadgets", kind: "goods" });
    expectWhoWhatWhen(await lastEntry("category.create"), "admin", /Added the category "Gadgets"/);
    await updateCategory(admin, made.id, { name: "Gadgets and tools" });
    expectWhoWhatWhen(await lastEntry("category.update"), "admin", /Changed the category "Gadgets and tools"/);
    await createSubcategory(admin, { categoryId: made.id, name: "Phones" });
    expectWhoWhatWhen(await lastEntry("subcategory.create"), "admin", /Added the subcategory "Phones"/);
    await deleteCategory(admin, made.id);
    expectWhoWhatWhen(await lastEntry("category.delete"), "admin", /Removed the category "Gadgets and tools"/);
  });

  it("SEO center: a saved and a removed title template", async () => {
    const fields = { title: "Jobs in {city} | {site}", description: "Browse {category} notices in {city} on {site}. Updated daily with clear photos and honest details.", h1: "", intro: "" };
    await saveTemplate(seo, { pageType: "location", categorySlug: "jobs", fields });
    expectWhoWhatWhen(await lastEntry("seo.template.save"), "seo_editor", /Saved the SEO template: /);
    await deleteTemplate(seo, "location:jobs");
    expectWhoWhatWhen(await lastEntry("seo.template.delete"), "seo_editor", /Removed the SEO template: /);
  });
});
