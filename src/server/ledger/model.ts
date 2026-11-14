import { Schema, type Types } from "mongoose";
import { appendOnlyPlugin, lockBulkWrites } from "@/server/audit/append-only";
import { LEDGER_ACCOUNTS } from "@/server/ledger/accounts";
import { registerModel } from "@/server/models/register";

export interface LedgerLineDoc {
  account: string;
  ownerKey: string;
  /** Signed coins. The deltas of one transaction always add up to zero. */
  delta: number;
  /** Position of this line in its (account, owner) chain. A unique chain key stops two writers taking the same position. */
  seq: number;
  chainKey: string;
  balanceAfter: number;
}

export interface LedgerTransactionDoc {
  _id?: Types.ObjectId;
  idempotencyKey: string;
  kind: string;
  refType: string;
  refId: string;
  lines: LedgerLineDoc[];
  createdAt?: Date;
}

const collection = "ledger_transactions";

const lineSchema = new Schema<LedgerLineDoc>(
  {
    account: { type: String, required: true, enum: LEDGER_ACCOUNTS },
    ownerKey: { type: String, required: true },
    delta: { type: Number, required: true },
    seq: { type: Number, required: true },
    chainKey: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
  },
  { _id: false },
);

const schema = new Schema<LedgerTransactionDoc>(
  {
    idempotencyKey: { type: String, required: true, unique: true },
    kind: { type: String, required: true },
    refType: { type: String, required: true },
    refId: { type: String, required: true },
    lines: { type: [lineSchema], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection },
);
// A multikey unique index is enforced across documents: it is what makes a double spend impossible.
schema.index({ "lines.chainKey": 1 }, { unique: true });
schema.index({ "lines.account": 1, "lines.ownerKey": 1 });
schema.index({ refType: 1, refId: 1 });
schema.pre("validate", function balanced() {
  const total = this.lines.reduce((sum, line) => sum + line.delta, 0);
  if (this.lines.length < 2 || total !== 0) throw new Error("Ledger transaction must balance");
});
appendOnlyPlugin(schema, collection);

export const LedgerTransaction = registerModel<LedgerTransactionDoc>("LedgerTransaction", schema);
lockBulkWrites(LedgerTransaction, collection);
