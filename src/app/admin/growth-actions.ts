"use server";

import { revalidatePath } from "next/cache";
import { getStaffFromHeaders } from "@/lib/admin-auth";
import { connectDb } from "@/lib/db";
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

export async function saveLandingForAdmin(input: { key: string; h1: string; intro: string; question: string; answer: string }) {
  try {
    await assertAdmin();
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z0-9| -]{3,80}$/.test(key)) return { ok: false as const, message: "Use a key like dating|gurgaon" };
    await connectDb();
    const site = await Site.findOne({ key: "default" });
    if (!site) return { ok: false as const, message: "Site is missing" };
    const landings = ((site as { landings?: Record<string, unknown> }).landings || {}) as Record<string, unknown>;
    landings[key] = {
      h1: input.h1.trim(),
      title: input.h1.trim(),
      description: input.intro.trim().slice(0, 180),
      intro: input.intro.trim(),
      faqs: input.question.trim() && input.answer.trim() ? [{ q: input.question.trim(), a: input.answer.trim() }] : [],
    };
    site.set("landings", landings);
    site.markModified("landings");
    await site.save();
    revalidatePath("/", "layout");
    return { ok: true as const };
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
    await connectDb();
    await Site.updateOne({ key: "default" }, { $set: { tags } });
    revalidatePath("/", "layout");
    return { ok: true as const, count: tags.length };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}

export async function saveFreeAdsForAdmin(count: number) {
  try {
    await assertAdmin();
    const freeAdsPerWeek = Math.max(0, Math.min(50, Math.round(count)));
    await connectDb();
    await Site.updateOne({ key: "default" }, { $set: { freeAdsPerWeek } });
    return { ok: true as const, freeAdsPerWeek };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
  }
}
