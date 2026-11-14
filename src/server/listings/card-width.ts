import { connectDb } from "@/lib/db";
import { isAdminRole } from "@/lib/ui/site-content";
import { AuditRepository } from "@/server/audit";
import { ForbiddenError } from "@/server/http";
import { cardWidthFrom, type CardWidth } from "@/server/listings/card-width-config";
import { Site } from "@/server/models";

export { CARD_WIDTHS, CARD_WIDTH_LABELS, DEFAULT_CARD_WIDTH, cardWidthFrom, type CardWidth } from "@/server/listings/card-width-config";

const SITE_KEY = "default";
const audit = new AuditRepository();

export async function loadCardWidth(): Promise<CardWidth> {
  await connectDb();
  const site = await Site.findOne({ key: SITE_KEY }).select("listingCardWidth").lean<{ listingCardWidth?: string } | null>();
  return cardWidthFrom(site?.listingCardWidth);
}

/** Admin and superadmin only. Writes the value and an audit row with the value before and after. */
export async function setCardWidth(input: { actor: { id: string; roles: string[] }; width: unknown; requestId: string }) {
  if (!isAdminRole(input.actor.roles)) throw new ForbiddenError("Only an admin can change the card width");
  const width = cardWidthFrom(input.width);
  const before = await loadCardWidth();
  await connectDb();
  await Site.updateOne({ key: SITE_KEY }, { $set: { listingCardWidth: width } }, { upsert: true });
  await audit.append({
    actorId: input.actor.id,
    actorType: "admin",
    action: "listing_pages.card_width.update",
    targetType: "site",
    targetId: SITE_KEY,
    requestId: input.requestId,
    before: { listingCardWidth: before },
    after: { listingCardWidth: width },
  });
  return width;
}
