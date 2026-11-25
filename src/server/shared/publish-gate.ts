import { isAtLeast18 } from "@/server/shared/age";

export type VerificationStatus = "unsubmitted" | "pending_review" | "approved" | "rejected";

export type AccountStatus = "active" | "suspended" | "deleted";

export type PublishBlockReason =
  | "UNDERAGE"
  | "AGE_REQUIRED"
  | "ADULT_ATTESTATION_REQUIRED"
  | "ACCOUNT_NOT_ACTIVE"
  | "VERIFICATION_REQUIRED"
  | "MEDIA_NOT_CLEARED"
  | "CATEGORY_DISABLED";

export interface PublishGateInput {
  dateOfBirth: Date | null;
  attestedAdult: boolean;
  verificationStatus: VerificationStatus;
  accountStatus: AccountStatus;
  categorySlug: string;
  categoryName: string;
  categoryEnabled: boolean;
  /** Every attached media asset must be status cleared. */
  mediaCleared: boolean;
  attributes: Record<string, unknown>;
  /** The "Require ID check before posting" switch (H6.14). When off, the approved-ID step is skipped. */
  idCheckRequired: boolean;
  /** True for a people listing (H10.1): its ad must carry a listed age of 18 or more, whatever form fields the category has. */
  peopleListing?: boolean;
  now?: Date;
}

export type PublishGateResult =
  | { ok: true }
  | { ok: false; reason: PublishBlockReason; detail?: string };

function listedAge(attributes: Record<string, unknown>): number | undefined {
  const raw = attributes.age;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d{1,3}$/.test(raw)) return Number(raw);
  return undefined;
}

/**
 * Publishing requires age 18 or older, an adult attestation, approved ID review (only when the
 * ID-check switch is on, H6.14), and cleared media. Category and attribute deny-lists run again here.
 */
export function evaluatePublishGate(input: PublishGateInput): PublishGateResult {
  const now = input.now ?? new Date();
  if (input.accountStatus !== "active") {
    return { ok: false, reason: "ACCOUNT_NOT_ACTIVE" };
  }
  if (!input.attestedAdult) {
    return { ok: false, reason: "ADULT_ATTESTATION_REQUIRED" };
  }
  if (!input.dateOfBirth || !isAtLeast18(input.dateOfBirth, now)) {
    return { ok: false, reason: "UNDERAGE" };
  }
  if (input.idCheckRequired && input.verificationStatus !== "approved") {
    return { ok: false, reason: "VERIFICATION_REQUIRED" };
  }
  if (!input.mediaCleared) {
    return { ok: false, reason: "MEDIA_NOT_CLEARED" };
  }
  if (!input.categoryEnabled) {
    return { ok: false, reason: "CATEGORY_DISABLED" };
  }
  const age = listedAge(input.attributes);
  if (input.peopleListing && age === undefined) {
    return { ok: false, reason: "AGE_REQUIRED", detail: "age" };
  }
  if (age !== undefined && age < 18) {
    return { ok: false, reason: "UNDERAGE", detail: "age" };
  }
  return { ok: true };
}
