"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { addPin, previewOrder, removePin, saveRankSettings, setFeedHidden, type PinInput } from "@/server/ranking/admin";
import type { RankSettings } from "@/server/ranking";

/** The role check lives in each service function; here we only pass the signed-in staff member along. */
async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  return { ok: false as const, message: error instanceof Error ? error.message : "Something went wrong" };
}

export async function saveSettingsAction(input: RankSettings) {
  try {
    return { ok: true as const, settings: await saveRankSettings(await actor(), input) };
  } catch (error) {
    return failed(error);
  }
}

export async function previewAction(scope: string, draft: RankSettings) {
  try {
    return { ok: true as const, rows: await previewOrder(await actor(), scope, draft) };
  } catch (error) {
    return failed(error);
  }
}

export async function addPinAction(input: PinInput) {
  try {
    await addPin(await actor(), input);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function removePinAction(pinId: string) {
  try {
    await removePin(await actor(), pinId);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}

export async function setHiddenAction(ref: string, hidden: boolean) {
  try {
    await setFeedHidden(await actor(), ref, hidden);
    return { ok: true as const };
  } catch (error) {
    return failed(error);
  }
}
