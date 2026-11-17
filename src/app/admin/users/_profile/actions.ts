"use server";

import { revalidatePath } from "next/cache";
import { adminContext } from "@/server/admin/context";
import { closeAccount, editProfile, editVendor, removeVerifiedBadge, type EditResult, type VendorInput } from "@/server/admin/user-profile";
import { HttpError } from "@/server/http";

/** H7.156: server actions behind the profile, vendor, badge and close account buttons of the Users drawer. Each answers { ok } and never throws a stack. */

export type ProfileResult = ({ ok: true } & EditResult) | { ok: false; message: string; fields?: Record<string, string[]> };

async function run(work: (ctx: Awaited<ReturnType<typeof adminContext>>) => Promise<EditResult>): Promise<ProfileResult> {
  try {
    const done = await work(await adminContext());
    revalidatePath("/admin/users/");
    return { ok: true, ...done };
  } catch (error) {
    if (error instanceof HttpError) return { ok: false, message: error.message, fields: error.fields };
    throw error;
  }
}

export async function editProfileAction(input: { userId: string; name: string; city?: string; phone?: string; reason?: string }): Promise<ProfileResult> {
  return run((ctx) =>
    editProfile(ctx, {
      userId: String(input.userId),
      name: String(input.name ?? ""),
      city: input.city === undefined ? undefined : String(input.city),
      phone: input.phone === undefined ? undefined : String(input.phone),
      reason: input.reason === undefined ? undefined : String(input.reason),
    }),
  );
}

export async function editVendorAction(input: VendorInput): Promise<ProfileResult> {
  return run((ctx) =>
    editVendor(ctx, {
      userId: String(input.userId),
      about: String(input.about ?? ""),
      whatsapp: String(input.whatsapp ?? ""),
      photoMediaId: String(input.photoMediaId ?? ""),
      hidden: input.hidden === true,
      reason: input.reason === undefined ? undefined : String(input.reason),
    }),
  );
}

export async function removeBadgeAction(input: { userId: string; reason: string }): Promise<ProfileResult> {
  return run((ctx) => removeVerifiedBadge(ctx, { userId: String(input.userId), reason: String(input.reason ?? "") }));
}

export async function closeAccountAction(input: { userId: string; reason: string; confirm: string }): Promise<ProfileResult> {
  return run((ctx) => closeAccount(ctx, { userId: String(input.userId), reason: String(input.reason ?? ""), confirm: String(input.confirm ?? "") }));
}
