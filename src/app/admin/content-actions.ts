"use server";

import { refreshPublicCache } from "@/lib/cache";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { applyHomepageChange, applyHomeSeoChange, ensureHomepageDocument } from "@/lib/ui/site-store";
import { readContent, type SiteContent } from "@/lib/ui/site-content";
import { connectDb } from "@/lib/db";
import { HttpError } from "@/server/http";
import { Site } from "@/server/models";

export async function loadHomepageForAdmin(): Promise<SiteContent> {
  const identity = await getStaffFromHeaders();
  if (!identity.roles.some((role) => role === "admin" || role === "superadmin")) {
    throw new Error("Only an admin can edit the homepage");
  }
  await ensureHomepageDocument();
  await connectDb();
  const site = await Site.findOne({ key: "default" }).lean();
  return readContent(site?.homepage);
}

export async function saveHomepageForAdmin(content: SiteContent) {
  const identity = await getStaffFromHeaders();
  try {
    const saved = await applyHomepageChange({
      roles: identity.roles,
      email: identity.email,
      content,
    });
    await refreshPublicCache();
    return { ok: true as const, content: saved };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function resetHomepageForAdmin() {
  const identity = await getStaffFromHeaders();
  try {
    const saved = await applyHomepageChange({
      roles: identity.roles,
      email: identity.email,
      content: null,
      reset: true,
    });
    await refreshPublicCache();
    return { ok: true as const, content: saved };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Reset failed" };
  }
}

/** Saves the home page title and description from the Home page editor. Admins only; the cache refresh runs in the save. */
export async function saveHomeSeoForAdmin(input: { seoTitle: string; seoDescription: string }) {
  const identity = await getStaffFromHeaders();
  try {
    const saved = await applyHomeSeoChange({
      roles: identity.roles,
      email: identity.email,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
    });
    return { ok: true as const, seoTitle: saved.seoTitle, seoDescription: saved.seoDescription };
  } catch (error) {
    const fields = error instanceof HttpError ? error.fields : undefined;
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed", fields };
  }
}
