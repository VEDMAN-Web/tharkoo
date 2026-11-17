/**
 * H8.43: ready-made replies for the support desk. They fill the reply box; the agent reads and edits before sending.
 * {name} is the customer's first name. No dashes, and "advertiser" for anyone who posts ads.
 */

export type ReplyTemplate = { key: string; label: string; body: string };

export const REPLY_TEMPLATES: readonly ReplyTemplate[] = [
  { key: "payment-pending", label: "Template: payment pending", body: "Hi {name}, thank you for writing. We can see your payment is still waiting to be confirmed. This can take a little while. We will check again and update you here as soon as it is confirmed." },
  { key: "credits-added", label: "Template: credits added", body: "Hi {name}, your payment is confirmed now and the credits are in your wallet. Sorry for the wait." },
  { key: "ad-held", label: "Template: ad waiting for review", body: "Hi {name}, your ad is waiting for a quick check before it goes live. This usually does not take long. We will tell you here if we need anything from you." },
  { key: "id-check", label: "Template: ID check", body: "Hi {name}, to verify your ID please upload a clear photo of an official ID where the name and photo are easy to read. We check it as soon as it arrives." },
  { key: "need-more", label: "Template: need more details", body: "Hi {name}, thank you for writing. Could you tell us a little more, for example the page you were on and what you expected to happen? A screenshot helps too." },
  { key: "closing", label: "Template: closing", body: "Hi {name}, we are glad we could help. If anything else comes up, write to us here at any time." },
];

/** The template text for this customer, or an empty string for an unknown key. */
export function fillTemplate(key: string, customerName: string): string {
  const template = REPLY_TEMPLATES.find((item) => item.key === key);
  if (!template) return "";
  const first = customerName.trim().split(/\s+/)[0] || "there";
  return template.body.replace(/\{name\}/g, first);
}
