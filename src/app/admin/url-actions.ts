"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { adminContext } from "@/server/admin/context";
import { adminWrite } from "@/server/admin/write";
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

async function audited<T>(action: string, target: { type: string; id: string }, summary: string, run: () => Promise<T>, texts?: unknown) {
  const ctx = await adminContext();
  const done = await adminWrite<T>(ctx, {
    perm: "settings.edit",
    action,
    target,
    texts,
    before: async () => null,
    apply: async () => ({ after: null, result: await run(), summary }),
  });
  return done.result;
}

export async function savePrefixesAction(input: Partial<Record<PathKey, string>>) {
  try {
    await assertAdmin();
    const paths = await audited("urls.prefixes", { type: "site", id: "url-prefixes" }, "Changed the URL prefixes", () => setPrefixes(input));
    return { ok: true as const, paths };
  } catch (error) {
    return failed(error);
  }
}

export async function renameCategoryAction(id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await audited("urls.rename", { type: "category", id }, `Renamed a category address to ${slug}`, () => renameCategory(id, slug)) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameLocationAction(id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await audited("urls.rename", { type: "location", id }, `Renamed a place address to ${slug}`, () => renameLocation(id, slug)) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameTagAction(previous: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await audited("urls.rename", { type: "tag", id: previous }, `Renamed a tag address to ${slug}`, () => renameTag(previous, slug)) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameContentAction(kind: "page" | "post", id: string, slug: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await audited("urls.rename", { type: kind, id }, `Renamed a ${kind} address to ${slug}`, () => renameContent(kind, id, slug)) };
  } catch (error) {
    return failed(error);
  }
}

export async function renameAdAction(id: string, title: string) {
  try {
    await assertAdmin();
    return { ok: true as const, slug: await audited("urls.rename", { type: "listing", id }, "Renamed an ad address", () => renameAd(id, title), title) };
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
    await audited("urls.override", { type: "url", id: input.path }, "Saved the page text overrides of an address", () => saveUrlOverride(input), [input.title, input.description, input.h1]);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function addRedirectAction(from: string, to: string) {
  try {
    await assertAdmin();
    await audited("urls.redirect.add", { type: "redirect", id: from }, `Added a redirect to ${to}`, () => saveRedirect(from, to));
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function editRedirectAction(id: string, to: string) {
  try {
    await assertAdmin();
    await audited("urls.redirect.edit", { type: "redirect", id }, `Pointed a redirect to ${to}`, () => updateRedirect(id, to));
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteRedirectAction(id: string) {
  try {
    await assertAdmin();
    await audited("urls.redirect.delete", { type: "redirect", id }, "Deleted a redirect", () => deleteRedirect(id));
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
    const count = await audited("urls.redirect.import", { type: "redirect", id: "csv" }, "Imported redirects from a CSV file", () => importRedirectCsv(csv));
    return { ok: true as const, count };
  } catch (error) {
    return failed(error);
  }
}
