import { isAtLeast18 } from "@/server/shared/age";
import { attributeDenied, categoryDenied } from "@/server/shared/policy";

export type VerificationStatus = "unsubmitted" | "pending_review" | "approved" | "rejected";

export type AccountStatus = "active" | "suspended" | "deleted";

export type PublishBlockReason =
  | "UNDERAGE"
  | "ADULT_ATTESTATION_REQUIRED"
  | "ACCOUNT_NOT_ACTIVE"
  | "VERIFICATION_REQUIRED"
  | "MEDIA_NOT_CLEARED"
  | "CATEGORY_DENIED"
  | "CATEGORY_DISABLED"
  | "ATTRIBUTE_DENIED";

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
 * Publishing requires age 18 or older, an adult attestation, approved ID review,
 * and cleared media. Category and attribute deny-lists run again here.
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
  if (input.verificationStatus !== "approved") {
    return { ok: false, reason: "VERIFICATION_REQUIRED" };
  }
  if (!input.mediaCleared) {
    return { ok: false, reason: "MEDIA_NOT_CLEARED" };
  }
  const category = categoryDenied(input.categorySlug, input.categoryName);
  if (category.denied) {
    return { ok: false, reason: "CATEGORY_DENIED", detail: category.term };
  }
  if (!input.categoryEnabled) {
    return { ok: false, reason: "CATEGORY_DISABLED" };
  }
  const age = listedAge(input.attributes);
  if (age !== undefined && age < 18) {
    return { ok: false, reason: "UNDERAGE", detail: "age" };
  }
  const attributes = attributeDenied(input.attributes);
  if (attributes.denied) {
    return { ok: false, reason: "ATTRIBUTE_DENIED", detail: attributes.key ?? attributes.term };
  }
  return { ok: true };
}
