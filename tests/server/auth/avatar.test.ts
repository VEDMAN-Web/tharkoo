import mongoose from "mongoose";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES } from "@/lib/ui/avatar";
import { removeAvatar, saveAvatar } from "@/server/auth/avatar";
import { createCodeAccount } from "@/server/auth/service";
import { ValidationError } from "@/server/http";
import { setCloudinaryClient, setCloudinaryUploader, type CloudinaryClient } from "@/server/media/client";
import { sweepOrphans } from "@/server/media/service";
import { User } from "@/server/models";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ENV = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;
const kept = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));

let uploads: { data: Buffer; folder: string; publicId: string; contentType: string }[] = [];
let destroyed: string[] = [];
let remote: string[] = [];

const photo = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#d1137a" } }).jpeg().toBuffer();

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  process.env.SESSION_SECRET = "session-secret";
  for (const name of ENV) process.env[name] = "test";
  setCloudinaryUploader(async (data, options) => {
    uploads.push({ data, folder: options.folder, publicId: options.publicId, contentType: options.contentType });
    return { url: `https://res.cloudinary.com/test/image/upload/${options.folder}/${options.publicId}.webp`, publicId: `${options.folder}/${options.publicId}` };
  });
  const client: CloudinaryClient = {
    resource: async () => null,
    destroy: async (publicId) => {
      destroyed.push(publicId);
    },
    list: async () => remote,
    signedDownload: () => "",
  };
  setCloudinaryClient(client);
  await connectMemoryMongo();
  await User.init();
});

afterAll(async () => {
  setCloudinaryUploader(null);
  setCloudinaryClient(null);
  for (const name of ENV) {
    if (kept[name] === undefined) delete process.env[name];
    else process.env[name] = kept[name];
  }
  delete process.env.SESSION_SECRET;
  await disconnectMemoryMongo();
});

beforeEach(async () => {
  uploads = [];
  destroyed = [];
  remote = [];
  await clearMemoryMongo();
});

describe("profile photo", () => {
  it("stores a 256px square WebP and puts its address on the account", async () => {
    const user = await createCodeAccount("photo@example.com");
    const saved = await saveAvatar(user.id, { type: "image/jpeg", data: await photo(1600, 900) });
    expect(uploads).toHaveLength(1);
    expect(uploads[0].contentType).toBe("image/webp");
    expect(uploads[0].folder).toBe("tharkoo/avatars");
    const meta = await sharp(uploads[0].data).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
    expect(meta.exif).toBeUndefined();
    const stored = await User.findById(user.id).lean();
    expect(stored?.avatarUrl).toBe(saved.avatarUrl);
    expect(stored?.avatarKey).toBe(`tharkoo/avatars/${uploads[0].publicId}`);
  });

  it("removes the old file when the photo changes, and both fields when it is removed", async () => {
    const user = await createCodeAccount("change@example.com");
    await saveAvatar(user.id, { type: "image/jpeg", data: await photo(300, 300) });
    const first = (await User.findById(user.id).lean())?.avatarKey;
    await saveAvatar(user.id, { type: "image/jpeg", data: await photo(400, 400) });
    expect(destroyed).toEqual([first]);
    const second = (await User.findById(user.id).lean())?.avatarKey;
    expect(await removeAvatar(user.id)).toEqual({ avatarUrl: null });
    expect(destroyed).toEqual([first, second]);
    const stored = await User.findById(user.id).lean();
    expect(stored?.avatarUrl).toBeUndefined();
    expect(stored?.avatarKey).toBeUndefined();
  });

  it("refuses a wrong type, a renamed file, a broken photo and a file over 5 MB", async () => {
    const user = await createCodeAccount("bad@example.com");
    const jpegStart = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    const bad = [
      { type: "image/gif", data: await photo(10, 10) },
      { type: "image/png", data: await photo(10, 10) },
      { type: "image/jpeg", data: jpegStart },
      { type: "image/jpeg", data: Buffer.concat([jpegStart, Buffer.alloc(AVATAR_MAX_BYTES)]) },
    ];
    for (const file of bad) await expect(saveAvatar(user.id, file)).rejects.toBeInstanceOf(ValidationError);
    expect(uploads).toHaveLength(0);
    expect((await User.findById(user.id).lean())?.avatarUrl).toBeUndefined();
  });

  it("is not treated as an orphan by the media cleanup", async () => {
    const user = await createCodeAccount("sweep@example.com");
    await saveAvatar(user.id, { type: "image/jpeg", data: await photo(300, 300) });
    const key = (await User.findById(user.id).lean())!.avatarKey!;
    remote = [key, "tharkoo/listings/nobody"];
    expect((await sweepOrphans({ dryRun: true })).remoteIds).toEqual(["tharkoo/listings/nobody"]);
  });
});
