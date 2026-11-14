import mongoose, { Types } from "mongoose";
import { imageMatchesType } from "@/server/chat/image";
import { ValidationError } from "@/server/http";
import { SupportTicket, TicketMessage } from "@/server/models/support";
import { SupportAttachment } from "@/server/models/support-attachment";
import { canWorkDesk } from "@/server/support/access";
import { SCREENSHOT_MAX_BYTES, SCREENSHOT_MAX_COUNT, SCREENSHOT_TYPES } from "@/server/support/constants";

export interface Screenshot {
  contentType: (typeof SCREENSHOT_TYPES)[number];
  data: Buffer;
}

function isScreenshotType(value: string): value is Screenshot["contentType"] {
  return (SCREENSHOT_TYPES as readonly string[]).includes(value);
}

/** The type comes from the bytes, not the file name, so a renamed file is refused. */
async function readScreenshot(file: File): Promise<Screenshot> {
  if (!isScreenshotType(file.type)) throw new ValidationError("Screenshots must be JPEG, PNG or WebP images");
  if (file.size > SCREENSHOT_MAX_BYTES) throw new ValidationError("Each screenshot must be 5 MB or smaller");
  const data = Buffer.from(await file.arrayBuffer());
  if (!imageMatchesType(data, file.type)) throw new ValidationError("That file is not a real JPEG, PNG or WebP image");
  return { contentType: file.type, data };
}

/** Reads and checks the `screenshots` files of a multipart request. Nothing is stored here. */
export async function screenshotsFrom(form: FormData | null): Promise<Screenshot[]> {
  if (!form) return [];
  const files = form.getAll("screenshots").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > SCREENSHOT_MAX_COUNT) {
    const message = `Attach up to ${SCREENSHOT_MAX_COUNT} screenshots`;
    throw new ValidationError(message, { screenshots: [message] });
  }
  const shots: Screenshot[] = [];
  for (const file of files) shots.push(await readScreenshot(file));
  return shots;
}

export async function storeScreenshots(ticketId: Types.ObjectId, uploadedBy: string, shots: Screenshot[]): Promise<Types.ObjectId[]> {
  if (shots.length === 0) return [];
  const docs = await SupportAttachment.insertMany(
    shots.map((shot) => ({
      ticketId,
      uploadedBy: new Types.ObjectId(uploadedBy),
      contentType: shot.contentType,
      byteSize: shot.data.length,
      data: shot.data,
    })),
  );
  return docs.map((doc) => doc._id);
}

/** An owner may see a screenshot only on a ticket they opened, and never on an internal note. */
export async function ownerCanSeeAttachment(userId: string, attachmentId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(attachmentId)) return false;
  const message = await TicketMessage.findOne({ attachments: new Types.ObjectId(attachmentId), internal: false })
    .select("ticketId")
    .lean<{ ticketId: Types.ObjectId } | null>();
  if (!message) return false;
  return Boolean(await SupportTicket.exists({ _id: message.ticketId, ownerId: userId }));
}

/** The screenshot when the viewer may see it, otherwise null. Staff on the desk may see any screenshot. */
export async function attachmentFor(viewer: { id: string; roles: readonly string[] }, attachmentId: string) {
  if (!mongoose.isValidObjectId(attachmentId)) return null;
  const allowed = canWorkDesk(viewer.roles) || (await ownerCanSeeAttachment(viewer.id, attachmentId));
  if (!allowed) return null;
  return SupportAttachment.findById(attachmentId).select("contentType data");
}
