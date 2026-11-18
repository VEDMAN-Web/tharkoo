import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { uploadCallOptions, uploadToCloudinary } from "@/server/media/client";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/**
 * H13.0: an incoming transformation is a string of steps. Given to the Cloudinary SDK as `transformation` it is read as the NAME of a saved
 * transformation ("t_fl_strip_profile/..."), which does not exist, and the upload fails. It must go in as `raw_transformation`.
 * This runs the SDK's own parameter builder, with no network and no uploader override, so the real bug would show here.
 */

const require = createRequire(import.meta.url);
const { build_upload_params } = require("cloudinary/lib/utils") as { build_upload_params: (options: Record<string, unknown>) => Record<string, unknown> };

const STEPS = "fl_strip_profile/l_text:Arial_40_bold:tharkoo.com,co_rgb:ffffff,o_60/fl_layer_apply,g_south_east,x_20,y_20";
const base = { contentType: "image/jpeg", folder: "tharkoo/listings", publicId: "abc123" } as const;

describe("H13.0 the transformation reaches Cloudinary as steps, not as a name", () => {
  it("builds the upload parameters with the exact steps string, never a t_ name", () => {
    const params = build_upload_params(uploadCallOptions({ ...base, transformation: STEPS }));
    expect(params.transformation).toBe(STEPS);
    expect(String(params.transformation).startsWith("t_")).toBe(false);
    expect(String(params.transformation)).toContain("fl_strip_profile");
    expect(String(params.transformation)).toContain("l_text:");
  });

  it("the old call (transformation as a string) is exactly what produced the t_ name", () => {
    const old = build_upload_params({ resource_type: "image", type: "upload", folder: base.folder, public_id: base.publicId, transformation: STEPS });
    expect(String(old.transformation).startsWith("t_")).toBe(true);
  });

  it("leaves the parameter out when there is no transformation, and keeps the overwrite and the video type", () => {
    const plain = uploadCallOptions({ ...base });
    expect(plain).not.toHaveProperty("raw_transformation");
    expect(build_upload_params(plain).transformation).toBeFalsy();
    expect(uploadCallOptions({ ...base, overwrite: true })).toMatchObject({ overwrite: true, invalidate: true });
    expect(uploadCallOptions({ ...base, resourceType: "video", transformation: "fl_strip_profile" })).toMatchObject({ resource_type: "video", raw_transformation: "fl_strip_profile" });
  });
});

describe("H13.0 the real server-side upload path", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    delete process.env.MONGODB_URI;
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    await connectMemoryMongo();
  });
  afterAll(async () => {
    for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) delete process.env[key];
    await disconnectMemoryMongo();
  });

  it("uploadToCloudinary hands the SDK a call whose built parameters carry the steps (and the watermark) and no t_ name", async () => {
    await clearMemoryMongo();
    const spy = vi.spyOn(cloudinary.uploader, "upload").mockResolvedValue({ secure_url: "https://res.cloudinary.com/demo/image/upload/x.jpg", public_id: "tharkoo/listings/abc123" } as never);
    try {
      await uploadToCloudinary(Buffer.from("x"), { ...base, transformation: "fl_strip_profile" });
      expect(spy).toHaveBeenCalledTimes(1);
      const given = spy.mock.calls[0][1] as Record<string, unknown>;
      expect(given).not.toHaveProperty("transformation");
      const built = build_upload_params(given);
      expect(String(built.transformation)).toContain("fl_strip_profile");
      expect(String(built.transformation).startsWith("t_")).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
