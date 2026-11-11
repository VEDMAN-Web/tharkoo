import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { collectionName, modelName } from "@/server/models/names";
import { registerModel } from "@/server/models/register";

export interface PromotionProductDoc {
  _id?: Types.ObjectId;
  code: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  durationDays: number;
  enabled?: boolean;
  seedBatch?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PromotionOrderDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  listingId: Types.ObjectId;
  productId: Types.ObjectId;
  status: "pending" | "active" | "failed";
  durationDays: number;
  startsAt?: Date;
  endsAt?: Date;
  autoRenew?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaymentDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  orderId: Types.ObjectId;
  idempotencyKey: string;
  provider?: string;
  providerRef?: string;
  providerEventId?: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed";
  createdAt?: Date;
  updatedAt?: Date;
}

/** Append-only wallet ledger. Balance is the latest balanceAfter for the user. */
export interface WalletEntryDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  delta: number;
  reason: string;
  refType: string;
  refId: string;
  balanceAfter: number;
  idempotencyKey: string;
  createdAt?: Date;
}

const promotionProductSchema = new Schema<PromotionProductDoc>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    durationDays: { type: Number, required: true },
    enabled: { type: Boolean, default: true },
    seedBatch: { type: String },
  },
  { timestamps: true, collection: collectionName("promotion_products", "PromotionProduct") },
);

const promotionOrderSchema = new Schema<PromotionOrderDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    listingId: { type: Schema.Types.ObjectId, required: true },
    productId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["pending", "active", "failed"], default: "pending" },
    durationDays: { type: Number, required: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
    autoRenew: { type: Boolean, default: false },
  },
  { timestamps: true, collection: collectionName("promotion_orders", "PromotionOrder") },
);
promotionOrderSchema.index({ listingId: 1, status: 1, endsAt: 1 });

const paymentSchema = new Schema<PaymentDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    orderId: { type: Schema.Types.ObjectId, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    provider: { type: String, default: "mock" },
    providerRef: { type: String },
    providerEventId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  },
  { timestamps: true, collection: collectionName("payments", "Payment") },
);
paymentSchema.index({ providerEventId: 1 }, { unique: true, sparse: true });

const walletCollection = collectionName("wallet_entries", "WalletEntry");
const walletEntrySchema = new Schema<WalletEntryDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    refType: { type: String, required: true },
    refId: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: walletCollection },
);
walletEntrySchema.index({ userId: 1, createdAt: -1 });
appendOnlyPlugin(walletEntrySchema, walletCollection);

export const PromotionProduct = registerModel<PromotionProductDoc>(
  modelName("PromotionProduct"),
  promotionProductSchema,
);
export const PromotionOrder = registerModel<PromotionOrderDoc>(
  modelName("PromotionOrder"),
  promotionOrderSchema,
);
export const Payment = registerModel<PaymentDoc>(modelName("Payment"), paymentSchema);
export const WalletEntry = registerModel<WalletEntryDoc>(modelName("WalletEntry"), walletEntrySchema);

lockBulkWrites(WalletEntry, walletCollection);
