"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { HttpError } from "@/server/http";
import type { HeaderProps } from "./model";
import { explainAddress, loadListingHeader, publishListingHeader, saveListingHeaderDraft, type ExplainedAddress, type ListingHeaderState } from "./server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T>(job: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await job()) } as Result<T>;
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("listing tab action failed", error);
    return { ok: false, error: "Something went wrong. Nothing was changed." };
  }
}

export async function loadListingHeaderAction(scope: string): Promise<Result<{ state: ListingHeaderState }>> {
  return run(async () => ({ state: await loadListingHeader(await adminContext(), String(scope)) }));
}

export async function saveListingHeaderAction(scope: string, header: HeaderProps): Promise<Result<{ savedAt: string; version: number }>> {
  return run(async () => saveListingHeaderDraft(await adminContext(), String(scope), { h1Template: String(header?.h1Template ?? ""), introTemplate: String(header?.introTemplate ?? ""), showCount: header?.showCount !== false, showUpdated: header?.showUpdated !== false }));
}

export async function publishListingHeaderAction(scope: string, note: string): Promise<Result<{ version: number; eventId: string; canUndo: boolean }>> {
  return run(async () => {
    const done = await publishListingHeader(await adminContext(), String(scope), String(note ?? "").trim() || undefined);
    revalidatePath("/admin/page-builder/");
    return done;
  });
}

export async function explainAddressAction(address: string): Promise<Result<{ explained: ExplainedAddress }>> {
  return run(async () => ({ explained: await explainAddress(await adminContext(), String(address ?? "")) }));
}
