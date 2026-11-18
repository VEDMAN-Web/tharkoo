import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

/** Roles that always sign in with a password. Users and sellers have no password (H7.2b). */
export const STAFF_ROLE_NAMES: ReadonlySet<string> = new Set([
  "admin",
  "superadmin",
  "moderator",
  "trust_safety",
  "support",
  "seo_editor",
  "finance",
  "blog_editor",
  "content_editor",
]);

/** The seller profile, asked once before the first ad (H7.2b). Name and city show on ads. Date of birth never shows. */
export interface SellerProfileDoc {
  name: string;
  city: string;
  whatsapp?: string;
  availableNow: boolean;
  completedAt: Date;
  /** H7.156: a short text about the vendor, written by staff for now. */
  about?: string;
  /** H7.156: the vendor's profile picture, from the media library (SiteMedia). */
  photoMediaId?: Types.ObjectId;
  /** H7.156: staff hid this vendor profile. It is never deleted. */
  hidden?: boolean;
}

export interface UserDoc {
  _id?: Types.ObjectId;
  email: string;
  /** Required for staff only. Users and sellers sign in with a code and have no password. */
  passwordHash?: string;
  displayName: string;
  /** Set once, in the seller profile step, before posting. Required for staff. Never shown on the site. */
  dateOfBirth?: Date;
  /** Set with dateOfBirth, when the 18+ tick is ticked. Required for staff. */
  attestedAdultAt?: Date;
  sellerProfile?: SellerProfileDoc | null;
  emailVerifiedAt?: Date;
  roles: string[];
  verificationStatus: "unsubmitted" | "pending_review" | "approved" | "rejected";
  extraFreeAds?: number;
  verificationId?: Types.ObjectId;
  status: "active" | "suspended" | "deleted";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SessionDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  userAgent?: string;
  ipHash?: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt?: Date;
}

export interface TokenDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt?: Date;
}

export interface IdentityDocuments {
  front: string;
  back?: string;
  selfie: string;
}

export interface IdentityVerificationDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "manual" | "vendor";
  /** Legacy single id. New rows set this to `documents.front`. Mongoose does not require it. */
  documentRef: string;
  documents?: IdentityDocuments;
  status: "pending_review" | "approved" | "rejected";
  dateOfBirthAsserted: Date;
  reviewerId?: Types.ObjectId;
  decisionReason?: string;
  decidedAt?: Date;
  createdAt?: Date;
}

/** Staff keep every field the old sign-up asked for. Users and sellers may leave them empty. */
function isStaffDoc(this: { roles?: string[] }) {
  return (this.roles ?? []).some((role) => STAFF_ROLE_NAMES.has(role));
}

const sellerProfileSchema = new Schema<SellerProfileDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    whatsapp: { type: String, trim: true, maxlength: 20 },
    availableNow: { type: Boolean, default: false },
    completedAt: { type: Date, required: true },
    about: { type: String, trim: true, maxlength: 500 },
    photoMediaId: { type: Schema.Types.ObjectId },
    hidden: { type: Boolean },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false, required: isStaffDoc },
    displayName: { type: String, required: true },
    dateOfBirth: { type: Date, required: isStaffDoc },
    attestedAdultAt: { type: Date, required: isStaffDoc },
    sellerProfile: { type: sellerProfileSchema, default: undefined },
    emailVerifiedAt: { type: Date },
    roles: { type: [String], default: ["user"] },
    verificationStatus: {
      type: String,
      enum: ["unsubmitted", "pending_review", "approved", "rejected"],
      default: "unsubmitted",
    },
    verificationId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["active", "suspended", "deleted"], default: "active" },
    // H11.1: free ads an admin gave this one person, on top of the site setting.
    extraFreeAds: { type: Number, min: 0, max: 1000, default: undefined },
  },
  { timestamps: true, collection: collectionName("users", "User") },
);
userSchema.index({ status: 1, createdAt: -1 });

const sessionSchema = new Schema<SessionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String },
    ipHash: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: collectionName("sessions", "Session") },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

function expiringTokenSchema(collection: string) {
  const schema = new Schema<TokenDoc>(
    {
      userId: { type: Schema.Types.ObjectId, required: true, index: true },
      tokenHash: { type: String, required: true, unique: true },
      expiresAt: { type: Date, required: true },
      usedAt: { type: Date },
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection },
  );
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return schema;
}

const identityDocumentsSchema = new Schema<IdentityDocuments>(
  {
    front: { type: String, required: true },
    back: { type: String },
    selfie: { type: String, required: true },
  },
  { _id: false },
);

const identityVerificationSchema = new Schema<IdentityVerificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    provider: { type: String, enum: ["manual", "vendor"], default: "manual" },
    documentRef: { type: String, required: false },
    documents: { type: identityDocumentsSchema, required: false },
    status: { type: String, enum: ["pending_review", "approved", "rejected"], required: true },
    dateOfBirthAsserted: { type: Date, required: true },
    reviewerId: { type: Schema.Types.ObjectId },
    decisionReason: { type: String },
    decidedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: collectionName("identity_verifications", "IdentityVerification"),
  },
);
identityVerificationSchema.index({ status: 1, createdAt: -1 });

export const User = registerModel<UserDoc>(modelName("User"), userSchema);
export const Session = registerModel<SessionDoc>(modelName("Session"), sessionSchema);
export const EmailVerificationToken = registerModel<TokenDoc>(
  modelName("EmailVerificationToken"),
  expiringTokenSchema(collectionName("email_verification_tokens", "EmailVerificationToken")),
);
export const PasswordResetToken = registerModel<TokenDoc>(
  modelName("PasswordResetToken"),
  expiringTokenSchema(collectionName("password_reset_tokens", "PasswordResetToken")),
);
export const IdentityVerification = registerModel<IdentityVerificationDoc>(
  modelName("IdentityVerification"),
  identityVerificationSchema,
);
