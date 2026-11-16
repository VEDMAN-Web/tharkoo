"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { homePickerData, setHomeSelectionBatch, type HomeSelectionRow } from "@/server/listings/home-selection";

async function actor() {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  return found ? { id: found.user.id, roles: found.user.roles } : null;
}

function failed(error: unknown) {
  return { ok: false as const, message: error instanceof Error ? error.message : "Something went wrong" };
}

export async function searchHomeAdsAction(query: string): Promise<{ ok: true; results: HomeSelectionRow[] } | { ok: false; message: string }> {
  try {
    const who = await actor();
    if (!who) return { ok: false, message: "Sign in again to search." };
    const data = await homePickerData(query);
    return { ok: true, results: data.results };
  } catch (error) {
    return failed(error);
  }
}

export async function saveHomeSelectionAction(
  items: { listingId: string; show: boolean; order: number }[],
): Promise<{ ok: true; changed: number } | { ok: false; message: string }> {
  try {
    const who = await actor();
    if (!who) return { ok: false, message: "Sign in again to make this change." };
    const saved = await setHomeSelectionBatch({ items, actor: who, requestId: randomUUID() });
    return { ok: true, changed: saved.changed };
  } catch (error) {
    return failed(error);
  }
}
