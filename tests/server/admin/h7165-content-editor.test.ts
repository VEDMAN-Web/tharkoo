import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { can } from "@/lib/admin/perms";
import { canOpenAdminPath } from "@/lib/admin-gate";
import type { AdminCtx } from "@/server/admin/context";
import { undoEvent } from "@/server/admin/undo/core";
import { setCategoryPictures } from "@/server/categories/manage";
import { ForbiddenError } from "@/server/http";
import { listSiteMedia } from "@/server/layout/media";
import { setPlacePictures } from "@/server/locations/manage";
import { AuditEvent, Category, Location, SiteMedia } from "@/server/models";
import { saveShellConfig } from "@/server/site-links/shell-config";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

const ROLES = ["content_editor"];
const editor: AdminCtx = { actorId: "000000000000000000000095", email: "editor@example.com", roles: ROLES, requestId: "r-ce" };

async function picture(alt = "A living room") {
  const doc = await SiteMedia.create({ url: `/uploads/${new mongoose.Types.ObjectId()}.png`, objectKey: `k-${Math.random()}`, alt, width: 1920, height: 700, bytes: 1000, contentType: "image/png", tags: [], uploadedBy: "e2e@example.test" });
  return String(doc._id);
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
  await AuditEvent.init();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
});

describe("the Content editor role (H7.165)", () => {
  it("saves a category picture and a place picture, reads the media library, and the change is audited with the role", async () => {
    const cat = await Category.create({ slug: "property", name: "Property", enabled: true, order: 0 });
    const asset = await picture();
    const done = await setCategoryPictures(editor, String(cat._id), { photo: { assetId: asset, alt: "A flat in Surat", focusX: 40, focusY: 60 }, band: null });
    expect(done.name).toBe("Property");
    expect(String((await Category.findById(cat._id).lean())?.photo?.mediaId)).toBe(asset);
    expect(await AuditEvent.findById(done.eventId).lean()).toMatchObject({ action: "category.pictures", actorRole: "content_editor" });
    const library = await listSiteMedia({ q: "", limit: 10 }, ROLES);
    expect(library.items.map((item) => item.id)).toContain(asset);
    const place = await Location.create({ slug: "surat", name: "Surat", type: "city", stateSlug: "gujarat", order: 0, enabled: true } as never);
    const placed = await setPlacePictures(editor, String(place._id), { photo: { assetId: asset, alt: "Surat", focusX: 50, focusY: 50 }, band: null });
    expect(placed.eventId).toBeTruthy();
  });

  it("can undo its own picture change, because Category, Location and UiText are open to it for writing", async () => {
    const cat = await Category.create({ slug: "jobs", name: "Jobs", enabled: true, order: 0 });
    const asset = await picture();
    const done = await setCategoryPictures(editor, String(cat._id), { photo: { assetId: asset, alt: "A busy office", focusX: 50, focusY: 50 }, band: null });
    expect(await undoEvent(editor, done.eventId)).toMatchObject({ ok: true });
    expect((await Category.findById(cat._id).lean())?.photo ?? null).toBeNull();
  });

  it("cannot change the header and footer links, which stay admin only", async () => {
    await expect(saveShellConfig({ actorId: editor.actorId, roles: ROLES, config: {}, requestId: "r" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("has no money, users, settings or team: the permissions are refused and the addresses stay closed", () => {
    for (const perm of ["orders.view", "wallet.view", "prices.view", "users.view", "users.edit", "settings.edit", "team.edit", "raw.json", "content.publish", "seo.edit"] as const) {
      expect(can(ROLES, perm), perm).toBe(false);
    }
    for (const path of ["/admin/finance/", "/admin/users/", "/admin/settings/", "/admin/team/", "/admin/prices/", "/admin/support/", "/admin/seo/"]) {
      expect(canOpenAdminPath(ROLES, path), path).toBe(false);
    }
  });

  it("opens its own screens", () => {
    for (const path of ["/admin/categories/", "/admin/locations/", "/admin/media/", "/admin/page-builder/", "/admin/menus/", "/admin/ui-text/", "/admin/content/"]) {
      expect(canOpenAdminPath(ROLES, path), path).toBe(true);
    }
    expect(can(ROLES, "content.write")).toBe(true);
    expect(can(["content_editor", "seo_editor"], "content.publish")).toBe(true);
  });
});
