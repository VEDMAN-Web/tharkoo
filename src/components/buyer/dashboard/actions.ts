"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { cleanGoal } from "@/server/listings/dashboard-math";
import { saveWeeklyGoal } from "@/server/listings/seller-dashboard";

export type GoalResult = { ok: true; goal: number } | { ok: false };

/** H14.3: saves the weekly views goal on the signed-in user. The number must be a whole number from 50 to 1,000,000. */
export async function saveGoalAction(value: string): Promise<GoalResult> {
  const found = await userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
  const goal = cleanGoal(value);
  if (!found || goal === null) return { ok: false };
  await saveWeeklyGoal(found.user.id, goal);
  revalidatePath("/u/account/");
  return { ok: true, goal };
}
