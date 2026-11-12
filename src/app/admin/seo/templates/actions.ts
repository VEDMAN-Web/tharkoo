"use server";

import { getStaffFromHeaders } from "@/lib/admin-auth";
import { HttpError } from "@/server/http";
import { deleteTemplate, saveTemplate, type TemplateInput } from "@/server/seo/templates";

async function actor() {
  const identity = await getStaffFromHeaders();
  return { roles: identity.roles, email: identity.email };
}

function failed(error: unknown) {
  if (error instanceof HttpError) {
    return { ok: false as const, message: error.message, fields: (error.fields ?? {}) as Record<string, string[]> };
  }
  console.error("seo template action failed", error);
  return { ok: false as const, message: "Something went wrong. Nothing was changed.", fields: {} as Record<string, string[]> };
}

export async function saveTemplateAction(input: TemplateInput) {
  try {
    return { ok: true as const, ...(await saveTemplate(await actor(), input)) };
  } catch (error) {
    return failed(error);
  }
}

export async function deleteTemplateAction(key: string) {
  try {
    return { ok: true as const, ...(await deleteTemplate(await actor(), key)) };
  } catch (error) {
    return failed(error);
  }
}
