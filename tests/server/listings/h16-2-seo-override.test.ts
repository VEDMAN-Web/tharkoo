import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { urlHeading } from "@/lib/seo/override";
import { UrlOverride } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

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

const NEW_PATH = "/dating/surat/coffee-and-long-walks-k7q2z/";
const OLD_PATH = "/ad/coffee-and-long-walks/";

describe("H16.2 per-URL SEO settings follow the ad to its new address", () => {
  it("uses a setting saved for the old /ad/ path when the new address has none", async () => {
    await UrlOverride.create({ path: OLD_PATH, h1: "Saved on the old path" });
    expect(await urlHeading(NEW_PATH, "Fallback", OLD_PATH)).toBe("Saved on the old path");
  });

  it("prefers the setting saved for the new address when both exist", async () => {
    await UrlOverride.create({ path: OLD_PATH, h1: "Old" });
    await UrlOverride.create({ path: NEW_PATH, h1: "New" });
    expect(await urlHeading(NEW_PATH, "Fallback", OLD_PATH)).toBe("New");
  });

  it("falls back to the default when neither has one, and ignores the old path when none is given", async () => {
    expect(await urlHeading(NEW_PATH, "Fallback", OLD_PATH)).toBe("Fallback");
    await UrlOverride.create({ path: OLD_PATH, h1: "Old" });
    expect(await urlHeading(NEW_PATH, "Fallback")).toBe("Fallback");
  });
});
