import { connectDb } from "@/lib/db";
import { AuditRepository } from "@/server/audit";
import { creditWallet, debitWallet, walletBalance } from "@/server/billing/ledger";
import { ConflictError, PaymentRequiredError, ValidationError, isDuplicateKey } from "@/server/http";
import { isLedgerAccount, mustStayNonNegative, type LedgerAccount } from "@/server/ledger/accounts";
import { LedgerTransaction, type LedgerLineDoc } from "@/server/ledger/model";
import { hashIp } from "@/server/shared/crypto";

const audit = new AuditRepository();
const ATTEMPTS = 8;

export interface LedgerMove {
  account: LedgerAccount;
  ownerKey: string;
  /** Signed whole coins: positive adds to the account, negative takes from it. */
  delta: number;
}

export interface PostInput {
  idempotencyKey: string;
  kind: string;
  refType: string;
  refId: string;
  moves: LedgerMove[];
  requestId: string;
  actorId?: string | null;
  actorType?: "user" | "admin" | "worker" | "system";
  reason?: string;
  ip?: string;
}

let ready: Promise<void> | null = null;
async function readyLedger() {
  await connectDb();
  if (!ready) ready = LedgerTransaction.init().then(() => undefined);
  try {
    await ready;
  } catch (error) {
    ready = null;
    throw error;
  }
}

/** Throws unless the moves are whole, non-zero, known accounts that add up to exactly zero. */
export function assertBalanced(moves: LedgerMove[]) {
  if (moves.length < 2) throw new ValidationError("Invalid request", { moves: ["At least two moves"] });
  let total = 0;
  for (const move of moves) {
    if (!isLedgerAccount(move.account) || !move.ownerKey) {
      throw new ValidationError("Invalid request", { moves: ["Unknown account"] });
    }
    if (!Number.isInteger(move.delta) || move.delta === 0) {
      throw new ValidationError("Invalid request", { moves: ["Whole, non-zero amounts only"] });
    }
    total += move.delta;
  }
  if (total !== 0) throw new ValidationError("Invalid request", { moves: ["Moves must balance"] });
}

function mergeByAccount(moves: LedgerMove[]) {
  const sums = new Map<string, LedgerMove>();
  for (const move of moves) {
    const key = `${move.account}|${move.ownerKey}`;
    const prior = sums.get(key);
    sums.set(key, prior ? { ...move, delta: prior.delta + move.delta } : { ...move });
  }
  return [...sums.values()].filter((move) => move.delta !== 0);
}

/** Balance and chain position of one account for one owner, derived from the ledger rows. */
async function tip(account: LedgerAccount, ownerKey: string) {
  const rows = await LedgerTransaction.aggregate<{ balance: number; seq: number }>([
    { $match: { "lines.account": account, "lines.ownerKey": ownerKey } },
    { $unwind: "$lines" },
    { $match: { "lines.account": account, "lines.ownerKey": ownerKey } },
    { $group: { _id: null, balance: { $sum: "$lines.delta" }, seq: { $max: "$lines.seq" } } },
  ]);
  return { balance: rows[0]?.balance ?? 0, seq: rows[0]?.seq ?? 0 };
}

/** Balance of any account. user_wallet is the existing WalletEntry chain, so there is still one wallet. */
export async function accountBalance(account: LedgerAccount, ownerKey: string) {
  await readyLedger();
  if (account === "user_wallet") return walletBalance(ownerKey);
  return (await tip(account, ownerKey)).balance;
}

/** Sum of every delta ever posted. Always zero. */
export async function trialBalance() {
  await readyLedger();
  const rows = await LedgerTransaction.aggregate<{ total: number }>([
    { $unwind: "$lines" },
    { $group: { _id: null, total: { $sum: "$lines.delta" } } },
  ]);
  return rows[0]?.total ?? 0;
}

function duplicate(error: unknown): boolean {
  if (isDuplicateKey(error)) return true;
  return typeof error === "object" && error !== null && "cause" in error && isDuplicateKey((error as { cause: unknown }).cause);
}

function walletRef(input: PostInput, index: number, suffix = "") {
  return { refType: `ledger:${input.kind}${suffix}`, refId: `${input.idempotencyKey}#${index}` };
}

/**
 * The user_wallet side runs through the existing WalletEntry chain (one wallet, not two). Each leg is idempotent on
 * the transaction key, so a replay after a crash finishes whatever half was missing.
 */
async function applyWalletLegs(input: PostInput, phase: "debit" | "credit") {
  for (const [index, move] of input.moves.entries()) {
    if (move.account !== "user_wallet") continue;
    const ref = walletRef(input, index);
    if (phase === "debit" && move.delta < 0) {
      await debitWallet({
        userId: move.ownerKey,
        amount: -move.delta,
        ...ref,
        requestId: input.requestId,
        actorId: input.actorId ?? undefined,
        ip: input.ip,
      });
    }
    if (phase === "credit" && move.delta > 0) {
      await creditWallet({
        userId: move.ownerKey,
        amount: move.delta,
        ...ref,
        requestId: input.requestId,
        actorId: input.actorId ?? undefined,
        actorType: input.actorType ?? "system",
        auditAction: `ledger.${input.kind}`,
        ip: input.ip,
      });
    }
  }
}

/** Gives back a wallet debit that was applied for a transaction that could not be written. */
async function undoWalletDebits(input: PostInput) {
  for (const [index, move] of input.moves.entries()) {
    if (move.account !== "user_wallet" || move.delta >= 0) continue;
    await creditWallet({
      userId: move.ownerKey,
      amount: -move.delta,
      ...walletRef(input, index, ":undo"),
      requestId: input.requestId,
      actorType: "system",
      reason: "refund",
      auditAction: `ledger.${input.kind}.undo`,
    });
  }
}

async function buildLines(moves: LedgerMove[], idempotencyKey: string) {
  const lines: LedgerLineDoc[] = [];
  for (const move of moves) {
    if (move.account === "user_wallet") {
      lines.push({
        account: move.account,
        ownerKey: move.ownerKey,
        delta: move.delta,
        seq: 0,
        chainKey: `user_wallet:${move.ownerKey}:${idempotencyKey}`,
        balanceAfter: 0,
      });
      continue;
    }
    const position = await tip(move.account, move.ownerKey);
    if (mustStayNonNegative(move.account) && position.balance + move.delta < 0) {
      throw new PaymentRequiredError("Insufficient balance");
    }
    const seq = position.seq + 1;
    lines.push({
      account: move.account,
      ownerKey: move.ownerKey,
      delta: move.delta,
      seq,
      chainKey: `${move.account}:${move.ownerKey}:${seq}`,
      balanceAfter: position.balance + move.delta,
    });
  }
  return lines;
}

/**
 * Posts one balanced transaction. All lines are one document, so they commit together or not at all.
 * Two writers that read the same balance cannot both commit: their chain keys collide and the loser re-reads.
 * Calling again with the same idempotency key returns the first result.
 */
export async function postTransaction(input: PostInput) {
  assertBalanced(input.moves);
  await readyLedger();
  const moves = mergeByAccount(input.moves);
  if (moves.length < 2) throw new ValidationError("Invalid request", { moves: ["Nothing to move"] });
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const existing = await LedgerTransaction.findOne({ idempotencyKey: input.idempotencyKey }).select("_id").lean();
    if (existing) {
      await applyWalletLegs(input, "credit");
      return { id: String(existing._id), created: false as const };
    }
    let debited = false;
    try {
      const lines = await buildLines(moves, input.idempotencyKey);
      await applyWalletLegs(input, "debit");
      debited = true;
      const doc = await LedgerTransaction.create({
        idempotencyKey: input.idempotencyKey,
        kind: input.kind,
        refType: input.refType,
        refId: input.refId,
        lines,
      });
      debited = false;
      await applyWalletLegs(input, "credit");
      await audit.append({
        actorId: input.actorId ?? null,
        actorType: input.actorType ?? "system",
        action: `ledger.${input.kind}`,
        targetType: "ledger",
        targetId: String(doc._id),
        requestId: input.requestId,
        reason: input.reason,
        ipHash: hashIp(input.ip),
        after: { refType: input.refType, refId: input.refId, moves: input.moves },
      });
      return { id: String(doc._id), created: true as const };
    } catch (error) {
      if (duplicate(error)) continue;
      if (debited) await undoWalletDebits(input);
      throw error;
    }
  }
  throw new ConflictError("Ledger is busy");
}
