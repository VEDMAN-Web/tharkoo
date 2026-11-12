"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { explainUrl } from "@/server/seo/explain";
import { assertSeoEditor } from "@/server/seo/staff";
import { runNow } from "@/server/seo/overview";

async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  if (error instanceof HttpError) return { ok: false as const, message: error.message };
  console.error("seo action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed." };
}

export async function runSeoCheckAction() {
  try {
    const result = await runNow(await actor());
    return { ok: true as const, counts: result.counts };
  } catch (error) {
    return failed(error);
  }
}

export async function explainUrlAction(url: string) {
  try {
    assertSeoEditor(await actor());
    const out = await explainUrl(String(url ?? "").slice(0, 500));
    return "error" in out ? { ok: false as const, message: out.error } : { ok: true as const, ...out };
  } catch (error) {
    return failed(error);
  }
}
