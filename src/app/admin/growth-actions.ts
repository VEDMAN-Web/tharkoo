"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { refreshPublicCache } from "@/lib/cache";
import { connectDb } from "@/lib/db";
import { storedFaqs } from "@/lib/seo/landing";
import { adminContext } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
import { Site } from "@/server/models";

function staff() {
  return getStaffFromHeaders();
}

async function assertAdmin() {
  const identity = await staff();
  if (!identity.roles.some((role) => role === "admin" || role === "superadmin")) {
    throw new Error("Only an admin can edit this");
  }
  return identity;
}

async function audited<T>(action: string, target: { type: string; id: string }, summary: string, after: Record<string, unknown> | null, run: () => Promise<T>, texts?: unknown) {
  const ctx = await adminContext();
  const done = await adminWrite<T>(ctx, {
    perm: "settings.edit",
    action,
    target,
    texts,
    before: async () => null,
    apply: async () => ({ after, result: await run(), summary }),
  });
  return done.result;
}

export async function saveLandingForAdmin(input: { key: string; h1: string; intro: string; faqs?: { q?: string; a?: string }[]; question?: string; answer?: string }) {
  try {
    await assertAdmin();
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9| -]{3,80}$/.test(key)) return { ok: false as const, message: "Use a key like dating|gurgaon" };
    const faqs = storedFaqs(input.faqs?.length ? input.faqs : [{ q: input.question, a: input.answer }]);
    return await audited(
      "landing.save",
      { type: "landing", id: key },
      `Saved the landing text for ${key}`,
      { h1: input.h1.trim(), intro: input.intro.trim(), faqs: faqs.length },
      async () => {
        await connectDb();
        const site = await Site.findOne({ key: "default" });
        if (!site) return { ok: false as const, message: "Site is missing" };
        const landings = ((site as { landings?: Record<string, unknown> }).landings || {}) as Record<string, unknown>;
        landings[key] = {
          h1: input.h1.trim(),
          title: input.h1.trim(),
          description: input.intro.trim().slice(0, 180),
          intro: input.intro.trim(),
          faqs,
        };
        site.set("landings", landings);
        site.markModified("landings");
        await site.save();
        await refreshPublicCache();
        return { ok: true as const, faqs };
      },
      [input.h1, input.intro, faqs],
    );
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function saveTagsForAdmin(raw: string) {
  try {
    await assertAdmin();
    const tags = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [slug, ...rest] = line.split(",");
        return { slug: (slug || "").trim().toLowerCase(), label: rest.join(",").trim() || (slug || "").trim() };
      })
      .filter((tag) => /^[a-z0-9-]{2,40}$/.test(tag.slug));
    return await audited(
      "tags.save",
      { type: "site", id: "tags" },
      `Saved ${tags.length} tags`,
      { count: tags.length },
      async () => {
        await connectDb();
        await Site.updateOne({ key: "default" }, { $set: { tags } });
        await refreshPublicCache();
        return { ok: true as const, count: tags.length };
      },
      tags,
    );
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function saveFreeAdsForAdmin(count: number) {
  try {
    await assertAdmin();
    const freeAdsPerWeek = Math.max(0, Math.min(50, Math.round(count)));
    return await audited("freeads.save", { type: "site", id: "free-ads-per-week" }, `Set the free ads per week to ${freeAdsPerWeek}`, { freeAdsPerWeek }, async () => {
      await connectDb();
      await Site.updateOne({ key: "default" }, { $set: { freeAdsPerWeek } });
      return { ok: true as const, freeAdsPerWeek };
    });
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}
