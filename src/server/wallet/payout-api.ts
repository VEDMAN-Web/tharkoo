import { z } from "zod";
import { json, readJson } from "@/server/billing/http";
import { parseInput } from "@/server/http";
import { pageQuerySchema } from "@/server/shared/schemas/common";
import { getPayoutKyc, payoutKycSchema, submitPayoutKyc } from "@/server/wallet/payout-kyc";
import { revealWithdrawalDetails } from "@/server/wallet/payout-reveal";
import {
  approveWithdrawal,
  listOwnWithdrawals,
  listPayoutsForStaff,
  markWithdrawalFailed,
  markWithdrawalPaid,
  payoutSummary,
  rejectWithdrawal,
  requestWithdrawal,
  WITHDRAWAL_STATUSES,
} from "@/server/wallet/withdrawals";

interface Actor {
  id: string;
  roles: readonly string[];
}

const withdrawBodySchema = z.object({ coins: z.number().int().min(1).max(1_000_000) }).strict();
const reasonBodySchema = z.object({ reason: z.string().trim().min(3).max(300) }).strict();
const referenceBodySchema = z
  .object({ reference: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9/_.-]+$/, "Use letters, digits and / _ . -") })
  .strict();
const statusQuerySchema = z.object({ status: z.enum(WITHDRAWAL_STATUSES).optional() });

/**
 * Payout routes under /api/wallet. Returns null when the path is not a payout route, so the wallet dispatcher can 404 it.
 * Vendor routes act on the signed-in user only. Admin routes need a finance or superadmin role (checked in the service).
 */
export async function handlePayoutRequest(request: Request, requestId: string, actor: Actor, segments: string[], ip: string): Promise<Response | null> {
  const method = request.method;
  const path = segments.join("/");
  const query = () => Object.fromEntries(new URL(request.url).searchParams);
  if (path === "payouts/summary" && method === "GET") return json(await payoutSummary(actor.id), requestId);
  if (path === "payouts/kyc" && method === "GET") return json(await getPayoutKyc(actor.id), requestId);
  if (path === "payouts/kyc" && method === "PUT") {
    const values = parseInput(payoutKycSchema, await readJson(request));
    return json(await submitPayoutKyc({ userId: actor.id, values, requestId, ip }), requestId);
  }
  if (path === "payouts/withdrawals" && method === "GET") {
    const page = parseInput(pageQuerySchema, query());
    const data = await listOwnWithdrawals(actor.id, page.page, page.pageSize);
    return json(data, requestId, 200, { page: page.page, pageSize: page.pageSize, total: data.total });
  }
  if (path === "payouts/withdrawals" && method === "POST") {
    const body = parseInput(withdrawBodySchema, await readJson(request));
    return json(await requestWithdrawal({ userId: actor.id, coins: body.coins, requestId, ip }), requestId);
  }
  if (path === "admin/payouts" && method === "GET") {
    const filter = parseInput(statusQuerySchema, query());
    return json({ items: await listPayoutsForStaff({ roles: actor.roles, status: filter.status }) }, requestId);
  }
  const [head, sub, id, action] = segments;
  if (head === "admin" && sub === "payouts" && id && action && method === "POST") {
    return staffAction(request, requestId, { id, actorId: actor.id, roles: actor.roles, ip }, action);
  }
  return null;
}

async function staffAction(
  request: Request,
  requestId: string,
  input: { id: string; actorId: string; roles: readonly string[]; ip: string },
  action: string,
): Promise<Response | null> {
  const base = { ...input, requestId };
  if (action === "approve") return json(await approveWithdrawal(base), requestId);
  // Full details for one withdrawal: finance or superadmin only, rate-limited and audited in the service. Sent with no-store.
  if (action === "reveal") return json(await revealWithdrawalDetails(base), requestId);
  if (action === "reject") {
    const body = parseInput(reasonBodySchema, await readJson(request));
    return json(await rejectWithdrawal({ ...base, reason: body.reason }), requestId);
  }
  if (action === "paid") {
    const body = parseInput(referenceBodySchema, await readJson(request));
    return json(await markWithdrawalPaid({ ...base, reference: body.reference }), requestId);
  }
  if (action === "failed") {
    const body = parseInput(reasonBodySchema, await readJson(request));
    return json(await markWithdrawalFailed({ ...base, reason: body.reason }), requestId);
  }
  return null;
}
