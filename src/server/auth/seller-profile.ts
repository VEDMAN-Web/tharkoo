import { z } from "zod";
import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError, NotFoundError, ValidationError, VerificationRequiredError } from "@/server/http";
import { User } from "@/server/models";
import type { SellerView } from "@/server/auth/service";
import { isAtLeast18, parseDateOnly } from "@/server/shared/age";
import { setOwnLiveChat } from "@/server/availability/service";

/**
 * H7.2b: the seller profile, asked once before the first ad. Name and city show on ads. WhatsApp is optional.
 * Date of birth and the 18+ tick are asked only while the account has no date of birth yet, and are never shown.
 */

const WHATSAPP_MIN_DIGITS = 8;
const WHATSAPP_MAX_DIGITS = 15;

export const sellerProfileBodySchema = z
  .object({
    name: z.string().trim().min(2, "Add your name, at least 2 letters.").max(60, "Use a shorter name, 60 letters at most."),
    city: z.string().trim().min(2, "Choose your city.").max(60, "Choose your city."),
    whatsapp: z.string().trim().max(20, "Use a shorter number.").regex(/^[+0-9 ()-]*$/, "Use digits only, with a + at the start if you like.").default(""),
    availableNow: z.boolean().default(false),
    /** H7.4c: the Live chat switch, asked in step 2 ("Turn on live chat?"). Left out means no change. */
    liveChat: z.boolean().optional(),
    dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.").optional(),
    adultConfirmed: z.boolean().optional(),
  })
  .strict();

export type SellerProfileBody = z.infer<typeof sellerProfileBodySchema>;

const audit = new AuditRepository();

/** Digits and a leading plus only. Empty means no WhatsApp number. */
export function normalizeWhatsapp(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < WHATSAPP_MIN_DIGITS || digits.length > WHATSAPP_MAX_DIGITS) return null;
  return raw.trim().startsWith("+") ? `+${digits}` : digits;
}

/**
 * Saves the seller profile for a signed-in user. The date of birth is taken only when the account has none yet,
 * so it is asked once. Anyone under 18 is refused before anything is written.
 */
export async function saveSellerProfile(input: { userId: string; body: SellerProfileBody; requestId: string }): Promise<{ seller: SellerView }> {
  await connectDb();
  const user = await User.findById(input.userId);
  if (!user) throw new NotFoundError("Account not found");
  if (user.status !== "active") throw new ForbiddenError("Account is not active");

  const whatsapp = normalizeWhatsapp(input.body.whatsapp);
  if (input.body.whatsapp && whatsapp === null) {
    throw new ValidationError("Invalid request", { whatsapp: ["Enter a WhatsApp number with 8 to 15 digits, or leave it empty"] });
  }

  // H22.4: posting an ad no longer needs a date of birth. It is taken only when the account has none and the form sends one.
  let dateOfBirth: Date | null = null;
  if (!user.dateOfBirth && input.body.dateOfBirth) {
    if (input.body.adultConfirmed !== true) {
      throw new ValidationError("Invalid request", { dateOfBirth: ["Enter your date of birth and tick the 18+ box"] });
    }
    dateOfBirth = parseDateOnly(input.body.dateOfBirth);
    if (!dateOfBirth) throw new ValidationError("Invalid request", { dateOfBirth: ["Invalid date"] });
    if (!isAtLeast18(dateOfBirth)) throw new VerificationRequiredError("You must be 18 or older to post an ad");
  }

  const completedAt = user.sellerProfile?.completedAt ?? new Date();
  const profile = {
    name: input.body.name,
    city: input.body.city,
    ...(whatsapp ? { whatsapp } : {}),
    availableNow: input.body.availableNow,
    completedAt,
  };
  const set: Record<string, unknown> = { sellerProfile: profile, displayName: input.body.name };
  if (dateOfBirth) {
    set.dateOfBirth = dateOfBirth;
    set.attestedAdultAt = new Date();
  }
  await User.updateOne({ _id: user._id }, { $set: set });
  if (input.body.liveChat !== undefined) await setOwnLiveChat(user._id.toString(), input.body.liveChat);
  await audit.append({
    actorId: user._id,
    actorType: "user",
    action: "auth.seller_profile.save",
    targetType: "user",
    targetId: user._id.toString(),
    requestId: input.requestId,
  });
  return {
    seller: {
      name: profile.name,
      city: profile.city,
      whatsapp: whatsapp ?? null,
      availableNow: profile.availableNow,
    },
  };
}
