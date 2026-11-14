import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addCategoryField, applyFieldEdits, readCategoryFields, uniqueKey, type FieldEdit } from "@/app/admin/categories/fields-service";
import {
  addFieldOptions,
  listFieldOptions,
  readFieldSettings,
  removeFieldOption,
  replaceFieldOptions,
  requireFieldAdmin,
  saveFieldSettings,
  type FieldActor,
} from "@/server/fields/service";
import { CategoryFieldOption, CategoryFieldSetting } from "@/server/fields/models";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/http";
import { AuditEvent, Category } from "@/server/models";
import { parseListingAttributes, type FieldDefinition } from "@/server/shared/fields";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin: FieldActor = { email: "admin@example.test", roles: ["admin"] };
const superadmin: FieldActor = { email: "root@example.test", roles: ["superadmin"] };
const seller: FieldActor = { email: "seller@example.test", roles: ["vendor"] };
const member: FieldActor = { email: "member@example.test", roles: ["user"] };

beforeAll(async () => {
  await connectMemoryMongo();
  await CategoryFieldOption.init();
  await CategoryFieldSetting.init();
});

beforeEach(async () => {
  await clearMemoryMongo();
  await Category.create({
    slug: "dating",
    name: "Dating",
    fields: [
      { key: "hair", label: "Hair", type: "multiselect", options: ["Old"], order: 0, enabled: true, filterable: true },
      { key: "age", label: "Age", type: "range", order: 1, enabled: true, filterable: true },
      { key: "looking", label: "Looking for", type: "select", options: [], order: 2, enabled: false },
    ],
  });
});

afterAll(async () => {
  await disconnectMemoryMongo();
});

const hairMirror = async () => (await Category.findOne({ slug: "dating" }).lean())?.fields?.find((field) => field.key === "hair")?.options;

describe("option lists are admin only", () => {
  it("refuses sellers and members on every write and read", async () => {
    for (const actor of [seller, member]) {
      await expect(listFieldOptions({ categorySlug: "dating", fieldKey: "hair" }, actor)).rejects.toThrow(ForbiddenError);
      await expect(addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Red", source: "paste", actor })).rejects.toThrow(ForbiddenError);
      await expect(removeFieldOption({ categorySlug: "dating", fieldKey: "hair", value: "Old", actor })).rejects.toThrow(ForbiddenError);
      await expect(replaceFieldOptions({ categorySlug: "dating", fieldKey: "hair", values: ["Red"], actor })).rejects.toThrow(ForbiddenError);
    }
    expect(await CategoryFieldOption.countDocuments({})).toBe(0);
    expect(await hairMirror()).toEqual(["Old"]);
  });

  it("refuses a sign-in with no admin role, and allows admin and superadmin", () => {
    expect(() => requireFieldAdmin(member)).toThrow(ForbiddenError);
    expect(() => requireFieldAdmin(admin)).not.toThrow();
    expect(() => requireFieldAdmin(superadmin)).not.toThrow();
  });

  it("refuses addCategoryField for a seller", async () => {
    await expect(addCategoryField({ slug: "dating", label: "Smoker", kind: "yesno", email: seller.email, roles: seller.roles })).rejects.toThrow(ForbiddenError);
  });
});

describe("admin option list", () => {
  it("copies the legacy list on first use, then adds pasted options in order without repeats", async () => {
    const page = await listFieldOptions({ categorySlug: "dating", fieldKey: "hair" }, admin);
    expect(page).toEqual({ total: 1, items: [{ value: "Old", order: 0 }] });

    const added = await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Blonde\nbrunette\nBLONDE\nAsh brown", source: "paste", actor: admin });
    expect(added).toMatchObject({ added: 3, skipped: 0, duplicates: 1, total: 4, rejected: [] });
    expect(await hairMirror()).toEqual(["Old", "Blonde", "brunette", "Ash brown"]);
  });

  it("skips options already in the list, whatever their case", async () => {
    const result = await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "old\nRed", source: "paste", actor: admin });
    expect(result).toMatchObject({ added: 1, skipped: 1, total: 2 });
  });

  it("reads a CSV file's first column and drops the header", async () => {
    const result = await addFieldOptions({
      categorySlug: "dating",
      fieldKey: "hair",
      text: 'option,notes\nPurple\n"Teal, dark",x\n',
      source: "csv",
      actor: admin,
    });
    expect(result).toMatchObject({ added: 2, total: 3 });
    expect(await hairMirror()).toEqual(["Old", "Purple", "Teal, dark"]);
  });

  it("searches and pages the list", async () => {
    await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Blonde\nBrunette\nBlack", source: "paste", actor: admin });
    const search = await listFieldOptions({ categorySlug: "dating", fieldKey: "hair", q: "BLO" }, admin);
    expect(search.items.map((item) => item.value)).toEqual(["Blonde"]);
    const page = await listFieldOptions({ categorySlug: "dating", fieldKey: "hair", offset: 1, limit: 2 }, admin);
    expect(page.total).toBe(4);
    expect(page.items.map((item) => item.value)).toEqual(["Blonde", "Brunette"]);
  });

  it("removes one option, keeps the mirror in step, and reports a missing one", async () => {
    await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Red", source: "paste", actor: admin });
    expect(await removeFieldOption({ categorySlug: "dating", fieldKey: "hair", value: "red", actor: admin })).toEqual({ total: 1 });
    expect(await hairMirror()).toEqual(["Old"]);
    await expect(removeFieldOption({ categorySlug: "dating", fieldKey: "hair", value: "Nope", actor: admin })).rejects.toThrow(NotFoundError);
  });

  it("refuses an empty replacement list, and options on a range field", async () => {
    await expect(replaceFieldOptions({ categorySlug: "dating", fieldKey: "hair", values: [" "], actor: admin })).rejects.toThrow("Add at least one option");
    await expect(listFieldOptions({ categorySlug: "dating", fieldKey: "age" }, admin)).rejects.toThrow(ValidationError);
  });

  it("writes an audit row for each change", async () => {
    await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Red", source: "paste", actor: admin });
    await removeFieldOption({ categorySlug: "dating", fieldKey: "hair", value: "Red", actor: admin });
    expect(await AuditEvent.countDocuments({ action: "category.field.options.add" })).toBe(1);
    expect(await AuditEvent.countDocuments({ action: "category.field.options.remove" })).toBe(1);
  });
});

describe("listing checks use the admin list", () => {
  it("refuses a value that is not in the admin list and accepts a listed one", async () => {
    await addFieldOptions({ categorySlug: "dating", fieldKey: "hair", text: "Blonde", source: "paste", actor: admin });
    const category = await Category.findOne({ slug: "dating" }).lean();
    const fields = (category?.fields ?? []) as unknown as FieldDefinition[];
    expect(() => parseListingAttributes(fields, { hair: ["Blonde", "Purple"] })).toThrow();
    expect(parseListingAttributes(fields, { hair: ["Blonde"] })).toMatchObject({ hair: ["Blonde"] });
  });
});

describe("field edits", () => {
  const current = [
    { key: "hair", label: "Hair", type: "multiselect", options: ["Old"], enabled: true, filterable: true, order: 0 },
    { key: "looking", label: "Looking for", type: "select", options: [], enabled: false, order: 1 },
  ];
  const edit = (overrides: Partial<FieldEdit>): FieldEdit => ({ key: "hair", label: "Hair", help: "", placeholder: "", required: false, ...overrides });

  it("switches a pick-many field to pick-one, and keeps its options", () => {
    const [hair] = applyFieldEdits(current, [edit({ type: "select" }), edit({ key: "looking", label: "Looking for" })]);
    expect(hair).toMatchObject({ type: "select", options: ["Old"] });
  });

  it("refuses a type change to a kind that is not a choice", () => {
    const sneaky = { ...edit({}), type: "text" } as unknown as FieldEdit;
    expect(() => applyFieldEdits(current, [sneaky, edit({ key: "looking", label: "Looking for" })])).toThrow(/only pick-one and pick-many/);
  });

  it("refuses to show a choice field on the post-ad form before it has options", () => {
    expect(() => applyFieldEdits(current, [edit({ key: "hair" }), edit({ key: "looking", label: "Looking for", enabled: true })])).toThrow(/add at least one option/);
  });

  it("refuses a list that adds or drops a field", () => {
    expect(() => applyFieldEdits(current, [edit({})])).toThrow(/not added or removed/);
  });

  it("keeps a unique key when a label is used twice", () => {
    expect(uniqueKey("Looking for!", new Set())).toBe("looking_for");
    expect(uniqueKey("Looking for", new Set(["looking_for"]))).toBe("looking_for_2");
    expect(uniqueKey("3 bedrooms", new Set())).toBe("f_3_bedrooms");
  });
});

describe("adding a field", () => {
  it("adds a field at the end, switched off, with a unique key", async () => {
    const first = await addCategoryField({ slug: "dating", label: "Looking for!", kind: "one", email: admin.email, roles: admin.roles });
    const second = await addCategoryField({ slug: "dating", label: "Looking for", kind: "text", email: admin.email, roles: admin.roles });
    expect(first).toEqual({ key: "looking_for", type: "select" });
    expect(second).toEqual({ key: "looking_for_2", type: "text" });
    const saved = await readCategoryFields("dating");
    const added = saved?.fields.find((field) => field.key === "looking_for");
    expect(added).toMatchObject({ enabled: false, filterable: false, order: 3 });
  });

  it("refuses a kind that is not one of the five", async () => {
    await expect(addCategoryField({ slug: "dating", label: "Pets", kind: "bogus", email: admin.email, roles: admin.roles })).rejects.toThrow(ValidationError);
  });
});

describe("settings: filter name and pick limit", () => {
  it("keeps a pick limit on a pick-many field only", async () => {
    await saveFieldSettings({ categorySlug: "dating", fieldKey: "hair", filterLabel: "Hair colour", maxPicks: 3, actor: admin });
    const looking = await saveFieldSettings({ categorySlug: "dating", fieldKey: "looking", filterLabel: "", maxPicks: 3, actor: admin });
    expect(looking).toEqual({ filterLabel: "", maxPicks: null });
    const settings = await readFieldSettings("dating");
    expect(settings.get("hair")).toEqual({ filterLabel: "Hair colour", maxPicks: 3 });
    const saved = await readCategoryFields("dating");
    expect(saved?.fields.find((field) => field.key === "hair")).toMatchObject({ filterLabel: "Hair colour", maxPicks: 3 });
  });

  it("refuses a pick limit outside 1 to 50 and a filter name over 40 characters", async () => {
    await expect(saveFieldSettings({ categorySlug: "dating", fieldKey: "hair", filterLabel: "", maxPicks: 0, actor: admin })).rejects.toThrow(ValidationError);
    await expect(saveFieldSettings({ categorySlug: "dating", fieldKey: "hair", filterLabel: "x".repeat(41), maxPicks: null, actor: admin })).rejects.toThrow(
      /at most 40/,
    );
  });
});
