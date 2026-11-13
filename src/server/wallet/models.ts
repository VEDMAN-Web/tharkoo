import { Schema, type Types } from "mongoose";
import { registerModel } from "@/server/models/register";

export type CoinPurchaseStatus = "pending" | "succeeded" | "failed" | "refunded";

export interface CoinPurchaseDoc {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  packId: Types.ObjectId;
  idempotencyKey: string;
  provider: string;
  providerPaymentId: string;
  coins: number;
  /** Rupees charged. */
  amount: number;
  currency: string;
  status: CoinPurchaseStatus;
  /** Percentages in force when the purchase was made. Shown on the record only: no tax logic. */
  tdsPercent: number;
  gstPercent: number;
  eventId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const purchaseSchema = new Schema<CoinPurchaseDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    packId: { type: Schema.Types.ObjectId, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    providerPaymentId: { type: String, required: true, unique: true },
    coins: { type: Number, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: { type: String, enum: ["pending", "succeeded", "failed", "refunded"], default: "pending" },
    tdsPercent: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    eventId: { type: String },
  },
  { timestamps: true, collection: "coin_purchases" },
);

export interface FinanceSettingsDoc {
  _id?: Types.ObjectId;
  key: string;
  tdsPercent: number;
  gstPercent: number;
  coinValueInr: number;
  minWithdrawCoins: number;
  withdrawCooldownDays: number;
  updatedAt?: Date;
}

const settingsSchema = new Schema<FinanceSettingsDoc>(
  {
    key: { type: String, required: true, unique: true },
    tdsPercent: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    coinValueInr: { type: Number, default: 100 },
    minWithdrawCoins: { type: Number, default: 5 },
    withdrawCooldownDays: { type: Number, default: 3 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: "finance_settings" },
);

export const CoinPurchase = registerModel<CoinPurchaseDoc>("CoinPurchase", purchaseSchema);
export const FinanceSettings = registerModel<FinanceSettingsDoc>("FinanceSettings", settingsSchema);
