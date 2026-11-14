"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { parsePageTitleTarget, resetPageTitle, savePageTitle, savePageTitleForEditor } from "@/server/seo/page-titles";

async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  if (error instanceof HttpError) {
    return { ok: false as const, message: error.message, fields: (error.fields ?? {}) as Record<string, string[]> };
  }
  console.error("page title action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed.", fields: {} as Record<string, string[]> };
}

type TitleInput = { seoTitle: string; seoDescription: string };

/** Saves from the Page titles tab (any SEO editor; the home page needs an admin). */
export async function savePageTitleAction(target: unknown, input: TitleInput) {
  try {
    const saved = await savePageTitle(await actor(), parsePageTitleTarget(target), { title: input.seoTitle, description: input.seoDescription });
    return { ok: true as const, seoTitle: saved.title, seoDescription: saved.description };
  } catch (error) {
    return failed(error);
  }
}

/** Saves from the Listing pages and Post-ad page editors (admins only). */
export async function saveEditorPageTitleAction(target: unknown, input: TitleInput) {
  try {
    const saved = await savePageTitleForEditor(await actor(), parsePageTitleTarget(target), { title: input.seoTitle, description: input.seoDescription });
    return { ok: true as const, seoTitle: saved.title, seoDescription: saved.description };
  } catch (error) {
    return failed(error);
  }
}

/** Clears the saved text for a row and returns what the page now shows. */
export async function resetPageTitleAction(target: unknown) {
  try {
    const values = await resetPageTitle(await actor(), parsePageTitleTarget(target));
    return { ok: true as const, seoTitle: values.title, seoDescription: values.description, saved: values.saved };
  } catch (error) {
    return failed(error);
  }
}
