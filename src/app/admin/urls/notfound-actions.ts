"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { cleanPath } from "@/lib/urls";
import { assertSeoEditor, recordSeo } from "@/app/admin/seo/staff";
import { HttpError } from "@/server/http";
import { connectDb } from "@/lib/db";
import { saveRedirect } from "@/server/urls/service";

export async function createRedirectFrom404Action(from: string, to: string) {
  try {
    const identity = await getStaffFromHeaders();
    const who = { roles: identity.roles, email: identity.email };
    assertSeoEditor(who);
    const source = String(from ?? "").trim();
    const target = String(to ?? "").trim();
    if (!source.startsWith("/") || !target.startsWith("/") || target.startsWith("//") || /\s/.test(source + target)) {
      return { ok: false as const, message: "Use paths on this site that start with /, such as /jobs/pune/" };
    }
    await connectDb();
    await saveRedirect(source, target);
    await recordSeo(who, "seo.redirect.create", "redirect", cleanPath(source), {}, { to: cleanPath(target), from404: true });
    return { ok: true as const };
  } catch (error) {
    if (error instanceof HttpError || error instanceof Error) return { ok: false as const, message: error.message };
    return { ok: false as const, message: "Could not create the redirect" };
  }
}
