import { Schema, type Types } from "mongoose";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export interface UserDoc {
  _id?: Types.ObjectId;
  email: string;
  passwordHash: string;
  displayName: string;
  dateOfBirth: Date;
  attestedAdultAt: Date;
  emailVerifiedAt?: Date;
  roles: string[];
  verificationStatus: "unsubmitted" | "pending_review" | "approved" | "rejected";
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

export interface IdentityVerificationDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  provider: "manual" | "vendor";
  documentRef: string;
  status: "pending_review" | "approved" | "rejected";
  dateOfBirthAsserted: Date;
  reviewerId?: Types.ObjectId;
  decisionReason?: string;
  decidedAt?: Date;
  createdAt?: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    attestedAdultAt: { type: Date, required: true },
    emailVerifiedAt: { type: Date },
    roles: { type: [String], default: ["user"] },
    verificationStatus: {
      type: String,
      enum: ["unsubmitted", "pending_review", "approved", "rejected"],
      default: "unsubmitted",
    },
    verificationId: { type: Schema.Types.ObjectId },
    status: { type: String, enum: ["active", "suspended", "deleted"], default: "active" },
  },
  { timestamps: true, collection: collectionName("users", "User") },
);

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

const identityVerificationSchema = new Schema<IdentityVerificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    provider: { type: String, enum: ["manual", "vendor"], default: "manual" },
    documentRef: { type: String, required: true },
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
