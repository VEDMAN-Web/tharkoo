"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { HttpError } from "@/server/http";
import { setMoneySettings, type MoneySettings } from "@/server/billing/money-settings";

export type MoneyResult = { ok: true; settings: MoneySettings } | { ok: false; error: string };

export async function saveMoneySettingsAction(values: Partial<MoneySettings>): Promise<MoneyResult> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!found) return { ok: false, error: "Sign in again" };
  try {
    const settings = await setMoneySettings({ actorId: found.user.id, roles: found.user.roles, values, requestId: randomUUID() });
    return { ok: true, settings };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, error: error.message };
    console.error("money settings save failed", error);
    return { ok: false, error: "The setting was not saved. Try again." };
  }
}
