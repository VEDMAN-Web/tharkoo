import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyFieldEdits, readCategoryFields, updateCategoryFields, type FieldEdit } from "@/app/admin/categories/fields-service";
import { buildPostCopy, POST_COPY_DEFAULTS, POST_STEPS, wizardFields } from "@/components/post/copy";
import { getPageBlocks } from "@/lib/layout/read";
import { validatePost } from "@/lib/ui/post-form";
import { postDefaultBlocks } from "@/server/layout/defaults/post";
import { getPublished, publish, saveDraft, validateBlocks } from "@/server/layout/service";
import { AuditEvent, Category, PageLayout, PageLayoutRevision } from "@/server/models";
import { denyTerm } from "@/server/shared/policy";
import { seedPostLayout } from "@/server/seed/layouts";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const admin = { email: "admin@example.test", roles: ["admin"] };

beforeAll(async () => {
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

const defaults = () => validateBlocks("post", postDefaultBlocks(), new Set());

async function seedCategory() {
  await Category.create({
    slug: "cars",
    name: "Cars",
    fields: [
      { key: "make", label: "Make", type: "text", required: true, order: 0 },
      { key: "fuel", label: "Fuel", type: "select", options: ["Petrol", "Diesel"], required: false, order: 1 },
      { key: "year", label: "Year", type: "number", required: false, order: 2 },
    ],
  });
}

const edits = (overrides: Partial<Record<string, Partial<FieldEdit>>> = {}, order = ["make", "fuel", "year"]): FieldEdit[] =>
  order.map((key) => ({
    key,
    label: key === "make" ? "Make" : key === "fuel" ? "Fuel" : "Year",
    help: "",
    placeholder: "",
    required: key === "make",
    options: key === "fuel" ? ["Petrol", "Diesel"] : [],
    ...overrides[key],
  }));

describe("post-ad default blocks", () => {
  it("are valid and cover every step once", () => {
    const blocks = defaults();
    const steps = blocks.filter((block) => block.type === "postStep").map((block) => block.props.stepKey);
    expect(steps).toEqual([...POST_STEPS]);
    expect(blocks.map((block) => block.type)).toEqual(expect.arrayContaining(["postIntro", "photoRules", "promotionPicker", "postSuccess"]));
  });

  it("give the wizard exactly the wording it has today", () => {
    const copy = buildPostCopy(defaults().filter((block) => block.visible));
    expect(copy.intro).toBeNull();
    expect(copy.steps).toEqual(POST_COPY_DEFAULTS.steps);
    expect(copy.photoRules).toEqual(POST_COPY_DEFAULTS.photoRules);
    expect(copy.promotion).toEqual(POST_COPY_DEFAULTS.promotion);
    expect(copy.promoteHidden).toBe(false);
    expect(copy.success.title).toBe("Your ad is live");
    expect(copy.success.primaryCta).toEqual({ label: "Your ads", href: "/u/account/ads/" });
    expect(buildPostCopy(null)).toBe(POST_COPY_DEFAULTS);
  });

  it("are seeded once as post/default version 1", async () => {
    expect(await seedPostLayout()).toBe(true);
    expect(await seedPostLayout()).toBe(false);
    const doc = await PageLayout.findOne({ key: "post", scope: "default" }).lean();
    expect(doc?.version).toBe(1);
    expect(await getPageBlocks("post", ["default"])).toHaveLength(defaults().length - 1); // the intro starts hidden
  });
});

describe("wizard copy from a published layout", () => {
  it("shows an edited step title and help text after publish", async () => {
    await seedPostLayout();
    const draft = (await getPublished("post", "default"))!.map((block) =>
      block.type === "postStep" && block.props.stepKey === "basics" ? { ...block, props: { ...block.props, title: "Tell us about it", help: "Takes two minutes." } } : block,
    );
    await saveDraft({ key: "post", scope: "default", blocks: draft, ...admin });
    await publish({ key: "post", scope: "default", ...admin });
    const copy = buildPostCopy(await getPageBlocks("post", ["default"]));
    expect(copy.steps.basics.title).toBe("Tell us about it");
    expect(copy.steps.basics.help).toBe("Takes two minutes.");
    expect(copy.steps.photos.title).toBe("Photos");
  });

  it("hides the promote step when it is switched off, and refuses to hide any other step", async () => {
    await seedPostLayout();
    const published = (await getPublished("post", "default"))!;
    const hide = (key: string) => published.map((block) => (block.type === "postStep" && block.props.stepKey === key ? { ...block, visible: false } : block));
    await expect(saveDraft({ key: "post", scope: "default", blocks: hide("photos"), ...admin })).rejects.toThrow(/only the promote step can be hidden/);
    await saveDraft({ key: "post", scope: "default", blocks: hide("promote"), ...admin });
    await publish({ key: "post", scope: "default", ...admin });
    const copy = buildPostCopy(await getPageBlocks("post", ["default"]));
    expect(copy.promoteHidden).toBe(true);
    expect(copy.steps.review.nextLabel).toBe("PUBLISH");
  });

  it("falls back to the current wording for empty labels and missing blocks", () => {
    const blocks = defaults().filter((block) => block.type !== "photoRules" && block.type !== "postSuccess");
    const emptied = blocks.map((block) => (block.type === "postStep" && block.props.stepKey === "review" ? { ...block, props: { ...block.props, nextLabel: "" } } : block));
    const copy = buildPostCopy(emptied);
    expect(copy.steps.review.nextLabel).toBe("PUBLISH");
    expect(copy.photoRules).toEqual(POST_COPY_DEFAULTS.photoRules);
    expect(copy.success).toEqual(POST_COPY_DEFAULTS.success);
  });
});

describe("category post fields", () => {
  it("shows a saved field label, help text and order in the data the wizard receives", async () => {
    await seedCategory();
    await updateCategoryFields({
      slug: "cars",
      edits: edits({ make: { label: "Brand", help: "As on the registration papers" }, fuel: { placeholder: "Pick one" } }, ["fuel", "make", "year"]),
      ...admin,
    });
    const saved = await readCategoryFields("cars");
    const fields = wizardFields(saved?.fields);
    expect(fields.map((field) => field.key)).toEqual(["fuel", "make", "year"]);
    expect(fields.find((field) => field.key === "make")).toMatchObject({ label: "Brand", help: "As on the registration papers", required: true });
    expect(fields.find((field) => field.key === "fuel")?.placeholder).toBe("Pick one");
    const audit = await AuditEvent.findOne({ action: "category.fields.update" }).lean();
    expect(audit?.targetType).toBe("category");
  });

  it("still rejects a post with a required field left empty, and accepts it once filled", () => {
    const fields = wizardFields([{ key: "make", label: "Brand", required: true, type: "text" }]);
    const base = { categoryId: "c", cityId: "x", nickname: "Sam", title: "Used hatchback", text: "A clean used car in good shape.", phone: "+919876543210", contactMode: "phone", age: "", terms: true, adult: true };
    const missing = validatePost({ ...base, attrs: {}, fields });
    expect(missing.make).toBeTruthy();
    expect(validatePost({ ...base, attrs: { make: "Maruti" }, fields }).make).toBeUndefined();
  });

  it("applies the required flag an admin sets", async () => {
    await seedCategory();
    await updateCategoryFields({ slug: "cars", edits: edits({ make: { required: false }, year: { required: true } }), ...admin });
    const fields = wizardFields((await readCategoryFields("cars"))?.fields);
    expect(fields.map((field) => field.required)).toEqual([false, false, true]);
  });

  it("can edit a category whose seeded field key has a hyphen, and keeps that key", async () => {
    await Category.create({ slug: "jobs", name: "Jobs", fields: [{ key: "work-mode", label: "Work mode", type: "select", options: ["Office", "Remote"], order: 0 }] });
    await updateCategoryFields({
      slug: "jobs",
      edits: [{ key: "work-mode", label: "Where you work", help: "", placeholder: "", required: true, options: ["Office", "Remote", "Hybrid"] }],
      ...admin,
    });
    const field = wizardFields((await readCategoryFields("jobs"))?.fields)[0];
    expect(field).toMatchObject({ key: "work-mode", label: "Where you work", required: true, options: ["Office", "Remote", "Hybrid"] });
  });

  it("refuses non-admin roles, unknown categories and a changed set of fields", async () => {
    await seedCategory();
    for (const roles of [["user"], ["moderator"], ["seo_editor"], []]) {
      await expect(updateCategoryFields({ slug: "cars", edits: edits(), email: "x@example.test", roles })).rejects.toThrow(/admin/i);
    }
    await expect(updateCategoryFields({ slug: "nope", edits: edits(), ...admin })).rejects.toThrow(/not found/i);
    await expect(updateCategoryFields({ slug: "cars", edits: edits().slice(1), ...admin })).rejects.toThrow(/not added or removed/);
    expect(await AuditEvent.countDocuments({ action: "category.fields.update" })).toBe(0);
  });

  it("uses the existing field schema and the forbidden-terms check on every string", async () => {
    await seedCategory();
    const current = (await readCategoryFields("cars"))!.fields;
    expect(() => applyFieldEdits(current, edits({ make: { label: "" } }))).toThrow(/Make|label/);
    expect(() => applyFieldEdits(current, edits({ fuel: { options: [] } }))).toThrow(/option/i);
    const bad = denyTerm("esc", "ort");
    expect(() => applyFieldEdits(current, edits({ make: { help: `Best ${bad} here` } }))).toThrow(/not allowed/);
    expect(() => applyFieldEdits(current, edits({ fuel: { options: ["Petrol", bad] } }))).toThrow(/not allowed/);
    expect(() => applyFieldEdits(current, edits({ make: { placeholder: bad } }))).toThrow(/not allowed/);
  });
});
