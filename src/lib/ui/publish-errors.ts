import type { PublishBlockReason } from "@/server/shared/publish-gate";

/**
 * Plain sentences for every reason the server can refuse to publish an ad (PublishBlockReason). The server sends the
 * code as the message; a person never sees the code.
 */
export const PUBLISH_MESSAGES: Record<PublishBlockReason, string> = {
  UNDERAGE: "You must be 18 or older to post an ad.",
  AGE_REQUIRED: "Enter your age (18 or over) to post in this category.",
  ADULT_ATTESTATION_REQUIRED: "Please confirm that you are 18 or older before you post.",
  ACCOUNT_NOT_ACTIVE: "Your account cannot post right now. Please contact support.",
  VERIFICATION_REQUIRED: "Verify your ID to publish.",
  MEDIA_NOT_CLEARED: "Your photos are still being checked. Try again in a minute.",
  CATEGORY_DISABLED: "This category is switched off for now. Pick another category.",
};

export function publishMessage(code: string | undefined | null): string | null {
  return code && code in PUBLISH_MESSAGES ? PUBLISH_MESSAGES[code as PublishBlockReason] : null;
}

export function insufficientCreditsLine(short: number): string {
  return short === 1 ? "You need 1 more credit to publish." : `You need ${short} more credits to publish.`;
}
