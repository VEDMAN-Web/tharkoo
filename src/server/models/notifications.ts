import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/**
 * H8.53: which bell items each staff member has read. The queues themselves are never changed.
 * An item is read for a person when they opened it after it appeared, or pressed "Mark all as read" after it appeared.
 */
export interface StaffNotificationReadDoc {
  _id?: Types.ObjectId;
  staffId: Types.ObjectId;
  /** `<kind>:<id>`, for example "report:65f0...". */
  itemKey: string;
  readAt: Date;
}

/** Old read marks are dropped after this long. By then the item has long left the queue or is covered by "Mark all as read". */
export const READ_KEEP_SECONDS = 60 * 24 * 60 * 60;

const readSchema = new Schema<StaffNotificationReadDoc>(
  {
    staffId: { type: Schema.Types.ObjectId, required: true },
    itemKey: { type: String, required: true, maxlength: 80 },
    readAt: { type: Date, required: true },
  },
  { collection: collectionName("staff_notification_reads", "StaffNotificationRead") },
);
readSchema.index({ staffId: 1, itemKey: 1 }, { unique: true });
readSchema.index({ readAt: 1 }, { expireAfterSeconds: READ_KEEP_SECONDS });

export interface StaffNotificationMarkDoc {
  _id?: Types.ObjectId;
  staffId: Types.ObjectId;
  /** Everything that appeared at or before this time counts as read for this person. */
  allReadBefore: Date;
}

const markSchema = new Schema<StaffNotificationMarkDoc>(
  {
    staffId: { type: Schema.Types.ObjectId, required: true },
    allReadBefore: { type: Date, required: true },
  },
  { collection: collectionName("staff_notification_marks", "StaffNotificationMark") },
);
markSchema.index({ staffId: 1 }, { unique: true });

export const StaffNotificationRead = registerModel<StaffNotificationReadDoc>(modelName("StaffNotificationRead"), readSchema);
export const StaffNotificationMark = registerModel<StaffNotificationMarkDoc>(modelName("StaffNotificationMark"), markSchema);
