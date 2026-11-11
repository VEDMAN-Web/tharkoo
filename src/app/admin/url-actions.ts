"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import {
  deleteRedirect,
  importRedirectCsv,
  listRedirects,
  redirectsToCsv,
  renameAd,
  renameCategory,
  renameContent,
  renameLocation,
  renameTag,
  saveRedirect,
  saveUrlOverride,
  searchAds,
  setPrefixes,
  updateRedirect,
} from "@/server/urls/service";
import type { PathKey } from "@/lib/urls";

async function assertAdmin() {
  const identity = await getStaffFromHeaders();
  if (!identity.roles.some((role) => role === "admin" || role === "superadmin")) {
    throw new Error("Only an admin can edit URLs");
  }
}

function failed(error: unknown) {
  return { ok: false as const, message: error instanceof Error ? error.message : "Save failed" };
}

export async function savePrefixesAction(input: Partial<Record<PathKey, string>>) {
  try {
    await assertAdmin();
    const paths = await setPrefixes(input);
    return { ok: true as const, paths };
  } catch (error) {
    return failed(error);
  }
}

export async function renameCategoryAction(id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await renameCategory(id, slug) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameLocationAction(id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await renameLocation(id, slug) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameTagAction(previous: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await renameTag(previous, slug) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameContentAction(kind: "page" | "post", id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await renameContent(kind, id, slug) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameAdAction(id: string, title: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await renameAd(id, title) };
  } catch (error) {
    return failed(error);
  }
}

export async function searchAdsAction(q: string) {
  try {
    await assertAdmin();
    const rows = await searchAds(q);
    return { ok: true as const, ads: rows.map((row) => ({ id: String(row._id), slug: row.slug || "", title: row.title || "" })) };
  } catch (error) {
    return failed(error);
  }
}

export async function saveOverrideAction(input: {
  path: string;
  title?: string;
  description?: string;
  h1?: string;
  canonical?: string;
  noindex?: boolean;
  ogImage?: string;
}) {
  try {
    await assertAdmin();
    await saveUrlOverride(input);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function addRedirectAction(from: string, to: string) {
  try {
    await assertAdmin();
    await saveRedirect(from, to);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function editRedirectAction(id: string, to: string) {
  try {
    await assertAdmin();
    await updateRedirect(id, to);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteRedirectAction(id: string) {
  try {
    await assertAdmin();
    await deleteRedirect(id);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function exportRedirectsAction() {
  try {
    await assertAdmin();
    const rows = await listRedirects();
    return { ok: true as const, csv: redirectsToCsv(rows) };
  } catch (error) {
    return failed(error);
  }
}

export async function importRedirectsAction(csv: string) {
  try {
    await assertAdmin();
    const count = await importRedirectCsv(csv);
    return { ok: true as const, count };
  } catch (error) {
    return failed(error);
  }
}
