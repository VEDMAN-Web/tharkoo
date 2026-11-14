import { siteOrigin } from "@/server/auth/http";
import { mailerFromEnv } from "@/server/mailer";
import { User } from "@/server/models";

/**
 * Tells the owner that support replied. The in-app badge is the main signal. Email is sent only when
 * a mail provider is configured (BREVO_API_KEY). The email carries no ticket text, only a link.
 */
export async function notifyOwnerOfReply(input: { ownerId: string; ticketId: string; number: number }) {
  if (!process.env.BREVO_API_KEY?.trim()) return;
  const owner = await User.findById(input.ownerId).select("email").lean();
  if (!owner?.email) return;
  const link = `${siteOrigin()}/u/account/support/${input.ticketId}/`;
  await mailerFromEnv().send({
    to: owner.email,
    subject: `Tharkoo support replied to ticket #${input.number}`,
    text: `Tharkoo support has replied to your ticket #${input.number}.\n\nSign in to read the reply: ${link}\n\nThe reply is not included in this email.`,
  });
}
