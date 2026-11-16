export type AdChannel = "phone" | "whatsapp";

export function contactChannelsOf(contact?: { phone?: string | null; whatsapp?: string | null } | null): AdChannel[] {
  const channels: AdChannel[] = [];
  if (contact?.phone?.trim()) channels.push("phone");
  if (contact?.whatsapp?.trim()) channels.push("whatsapp");
  return channels;
}
