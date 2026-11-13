import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { saveSeoSettings } from "@/app/admin/seo/settings/store";
import { invalidateTags } from "@/lib/cache";
import { hubCopy, siteOrganizationNode, defaultOgImage } from "@/lib/seo-site";
import { applyDefaultOgImage, withSeoDefaults } from "@/lib/ui/meta-defaults";
import { pageMetadata } from "@/lib/ui/meta";
import { saveUrlOverride } from "@/server/urls/service";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

function resetDbCache() {
  const g = globalThis as { mongoose?: { conn: unknown; promise: unknown } };
  if (g.mongoose) {
    g.mongoose.conn = null;
    g.mongoose.promise = null;
  }
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  resetDbCache();
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
  resetDbCache();
});
beforeEach(async () => {
  await clearMemoryMongo();
  invalidateTags(["site", "urls", "listings"]);
});

const editor = { roles: ["superadmin"], email: "root@example.test" };
const fallback = { intro: "Built-in intro.", faqs: [{ q: "Old Q?", a: "Old A." }] };

describe("hub page copy", () => {
  it("shows the intro and questions saved for that URL", async () => {
    await saveUrlOverride({ path: "/jobs/pune/", intro: "Custom intro for Pune.", faq: [{ q: "New Q?", a: "New A." }] });
    const copy = await hubCopy("/jobs/pune/", fallback);
    expect(copy.intro).toBe("Custom intro for Pune.");
    expect(copy.faqs).toEqual([{ q: "New Q?", a: "New A." }]);
  });

  it("keeps the built-in copy when no override exists", async () => {
    await saveUrlOverride({ path: "/jobs/pune/", intro: "Custom intro for Pune." });
    expect(await hubCopy("/jobs/mumbai/", fallback)).toEqual(fallback);
    const introOnly = await hubCopy("/jobs/pune/", fallback);
    expect(introOnly.intro).toBe("Custom intro for Pune.");
    expect(introOnly.faqs).toEqual(fallback.faqs);
  });
});

describe("organization and default image settings", () => {
  it("uses the saved organization details in the JSON-LD", async () => {
    await saveSeoSettings(editor, {
      organization: { name: "Tharkoo Ltd", logo: "https://cdn.example.test/logo.png", sameAs: ["https://social.example.test/tharkoo"], email: "help@example.test", phone: "+91 11 5550 0000" },
    });
    invalidateTags(["site"]);
    const node = (await siteOrganizationNode("Tharkoo", { logo: "https://built.in/logo.svg" })) as Record<string, unknown>;
    expect(node.name).toBe("Tharkoo Ltd");
    expect(node.logo).toBe("https://cdn.example.test/logo.png");
    expect(node.sameAs).toEqual(["https://social.example.test/tharkoo"]);
    expect(node.contactPoint).toMatchObject({ email: "help@example.test", telephone: "+91 11 5550 0000" });
  });

  it("falls back to the built-in organization when the settings are empty", async () => {
    const node = (await siteOrganizationNode("Tharkoo", { logo: "https://built.in/logo.svg" })) as Record<string, unknown>;
    expect(node.name).toBe("Tharkoo");
    expect(node.logo).toBe("https://built.in/logo.svg");
    expect(node.contactPoint).toBeUndefined();
  });

  it("puts the default OG image on pages that have none, and keeps a page's own image", async () => {
    await saveSeoSettings(editor, { defaultOgImage: "https://cdn.example.test/share.png" });
    invalidateTags(["site"]);
    expect(await defaultOgImage()).toBe("https://cdn.example.test/share.png");
    const plain = await withSeoDefaults(pageMetadata({ title: "T", description: "D", path: "/jobs/" }));
    const og = plain.openGraph as { images: { url: string }[] };
    expect(og.images[0].url).toBe("https://cdn.example.test/share.png");
    expect((plain.twitter as { images: string[] }).images[0]).toBe("https://cdn.example.test/share.png");
    const own = await withSeoDefaults(pageMetadata({ title: "T", description: "D", path: "/jobs/", image: "https://cdn.example.test/own.png" }));
    expect((own.openGraph as { images: { url: string }[] }).images[0].url).toBe("https://cdn.example.test/own.png");
  });

  it("keeps the built-in image when no default is set", async () => {
    const meta = pageMetadata({ title: "T", description: "D", path: "/jobs/" });
    expect(applyDefaultOgImage(meta, "")).toBe(meta);
    expect(await defaultOgImage()).toBe("");
    const out = await withSeoDefaults(meta);
    expect((out.openGraph as { images: { url: string }[] }).images[0].url).toContain("/brand/og-default.png");
  });
});

describe("site-wide default image on pages with per-URL SEO", () => {
  it("gives a page without its own image the default from the settings", async () => {
    await saveSeoSettings(editor, { defaultOgImage: "https://cdn.example.test/share.png" });
    const { withUrlSeo } = await import("@/lib/seo/override");
    const meta = await withUrlSeo("/jobs/", { title: "Jobs", description: "Jobs list", path: "/jobs/" });
    expect(JSON.stringify(meta.openGraph?.images)).toContain("https://cdn.example.test/share.png");
  });

  it("keeps a page's own image", async () => {
    await saveSeoSettings(editor, { defaultOgImage: "https://cdn.example.test/share.png" });
    const { withUrlSeo } = await import("@/lib/seo/override");
    const meta = await withUrlSeo("/jobs/", { title: "Jobs", description: "Jobs list", path: "/jobs/", image: "https://cdn.example.test/own.png" });
    const text = JSON.stringify(meta.openGraph?.images);
    expect(text).toContain("own.png");
    expect(text).not.toContain("share.png");
  });
});
