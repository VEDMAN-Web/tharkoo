import { InternalError, ValidationError } from "@/server/http";
import { passimpayConfigured, passimpayCurrencies, passimpayValidateAddress, type PassimpayCurrency } from "@/server/billing/passimpay";

/** H19.9: the coins a vendor can be paid in. A coin is only offered when PassimPay lists it (see payoutCurrencies). */
export type PayoutCoin = "USDT" | "USDC" | "BTC" | "ETH" | "TRX" | "LTC";
export type PayoutNetwork = "TRC20" | "BEP20" | "ERC20" | "BTC" | "LTC";

export interface PayoutOption {
  coin: PayoutCoin;
  network: PayoutNetwork;
  label: string;
  /** Digits after the point when an amount is shown or sent. */
  decimals: number;
  /** Smallest amount worth sending, in coins. */
  min: number;
  /** Names PassimPay may use for this network in /v2/currencies. */
  platforms: readonly string[];
  address: RegExp;
  addressHint: string;
}

const TRON = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;
const BTC_ADDR = /^(bc1[a-z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
const LTC_ADDR = /^(ltc1[a-z0-9]{25,62}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$/;

const TRC20_NAMES = ["TRC20", "TRON", "TRX"] as const;
const BEP20_NAMES = ["BEP20", "BSC", "BNB", "BNB CHAIN"] as const;
const ERC20_NAMES = ["ERC20", "ETH", "ETHEREUM"] as const;

export const PAYOUT_OPTIONS: readonly PayoutOption[] = [
  { coin: "USDT", network: "TRC20", label: "USDT · TRON (TRC20)", decimals: 2, min: 1, platforms: TRC20_NAMES, address: TRON, addressHint: "starts with T" },
  { coin: "USDT", network: "BEP20", label: "USDT · BNB Chain (BEP20)", decimals: 2, min: 1, platforms: BEP20_NAMES, address: EVM, addressHint: "starts with 0x" },
  { coin: "USDC", network: "ERC20", label: "USDC · Ethereum (ERC20)", decimals: 2, min: 1, platforms: ERC20_NAMES, address: EVM, addressHint: "starts with 0x" },
  { coin: "USDC", network: "BEP20", label: "USDC · BNB Chain (BEP20)", decimals: 2, min: 1, platforms: BEP20_NAMES, address: EVM, addressHint: "starts with 0x" },
  { coin: "BTC", network: "BTC", label: "Bitcoin (BTC)", decimals: 8, min: 0.00001, platforms: ["BTC", "BITCOIN"], address: BTC_ADDR, addressHint: "starts with 1, 3 or bc1" },
  { coin: "ETH", network: "ERC20", label: "Ethereum (ETH)", decimals: 6, min: 0.0001, platforms: ERC20_NAMES, address: EVM, addressHint: "starts with 0x" },
  { coin: "TRX", network: "TRC20", label: "Tron (TRX)", decimals: 2, min: 1, platforms: TRC20_NAMES, address: TRON, addressHint: "starts with T" },
  { coin: "LTC", network: "LTC", label: "Litecoin (LTC)", decimals: 6, min: 0.0001, platforms: ["LTC", "LITECOIN"], address: LTC_ADDR, addressHint: "starts with L, M, 3 or ltc1" },
];

export const PAYOUT_COINS = ["USDT", "USDC", "BTC", "ETH", "TRX", "LTC"] as const;
export const PAYOUT_NETWORKS = ["TRC20", "BEP20", "ERC20", "BTC", "LTC"] as const;

/** The two USDT ids that H18.6 already pays through (from /v2/currencies). These need no lookup. */
const STATIC_USDT_IDS: Record<string, number> = { "USDT:TRC20": 71, "USDT:BEP20": 72 };

/** Rate movement allowance shown in the range: the estimate is cut and raised by this many percent. */
export const RANGE_PERCENT = 3;
/** How long a coin list (with its live rates) is reused before PassimPay is asked again. */
export const RATE_CACHE_MS = 5 * 60_000;

export const RATE_UNAVAILABLE = "Rate unavailable, the admin confirms the exact amount";

export function findPayoutOption(coin: string, network: string): PayoutOption | null {
  return PAYOUT_OPTIONS.find((option) => option.coin === coin && option.network === network) ?? null;
}

/** Rupees per 1 USDT (about 1 US dollar). Server setting USDT_INR_RATE; 88 when unset. This is the INR to USD rate. */
export function usdtInrRate(): number {
  const rate = Number(process.env.USDT_INR_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 88;
}

interface CacheEntry {
  at: number;
  list: PassimpayCurrency[];
}
let cache: CacheEntry | null = null;
let inFlight: Promise<PassimpayCurrency[]> | null = null;

/** Tests clear the five-minute cache here. */
export function resetPayoutCoinCache() {
  cache = null;
  inFlight = null;
}

/** The PassimPay coin list, reused for 5 minutes. Throws when PassimPay cannot be reached and nothing fresh is cached. */
export async function payoutCurrencies(): Promise<PassimpayCurrency[]> {
  if (cache && Date.now() - cache.at < RATE_CACHE_MS) return cache.list;
  if (!inFlight) {
    inFlight = passimpayCurrencies()
      .then((list) => {
        cache = { at: Date.now(), list };
        return list;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

function entryFor(list: PassimpayCurrency[], option: PayoutOption) {
  return list.find((item) => item.currency === option.coin && option.platforms.includes(item.platform)) ?? null;
}

/** The options PassimPay lists right now. Unsupported coins are left out. */
export async function listSupportedPayoutOptions(): Promise<PayoutOption[]> {
  const list = await payoutCurrencies();
  return PAYOUT_OPTIONS.filter((option) => entryFor(list, option));
}

/**
 * H19.9: the coins shown to a vendor choosing where to be paid. Only what PassimPay lists. If PassimPay cannot be reached the two
 * USDT options (the ones H18.6 already pays) are shown, and saving still checks the address. With no PassimPay setup (local
 * development) every option is shown so the form can be tried.
 */
export async function offeredPayoutOptions(): Promise<PayoutOption[]> {
  if (!passimpayConfigured()) return [...PAYOUT_OPTIONS];
  try {
    return await listSupportedPayoutOptions();
  } catch {
    return PAYOUT_OPTIONS.filter((option) => option.coin === "USDT");
  }
}

/** The PassimPay payment id used to send one coin. USDT on TRON or BNB Chain uses the fixed H18.6 ids; the rest are looked up. */
export async function resolvePaymentId(coin: string, network: string): Promise<number> {
  const fixed = STATIC_USDT_IDS[`${coin}:${network}`];
  if (fixed) return fixed;
  const option = findPayoutOption(coin, network);
  if (!option) throw new ValidationError("That coin is not available for payouts", { network: ["That coin is not available for payouts"] });
  const entry = entryFor(await payoutCurrencies(), option);
  if (!entry) throw new ValidationError("That coin is not available for payouts right now", { network: ["That coin is not available for payouts right now"] });
  return entry.id;
}

export interface PayoutEstimate {
  coin: PayoutCoin;
  network: PayoutNetwork;
  low: string;
  high: string;
  text: string;
}

function roundTo(value: number, decimals: number, direction: "down" | "up") {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const rounded = direction === "down" ? Math.floor(scaled + 1e-9) : Math.ceil(scaled - 1e-9);
  return (rounded / factor).toFixed(decimals);
}

/** Pure maths: rupees to coins at a live USD price, then minus and plus RANGE_PERCENT. The low end rounds down and the high end up. */
export function estimateRange(amountInr: number, rateUsd: number, option: PayoutOption, inrPerUsd = usdtInrRate()): PayoutEstimate | null {
  if (!(amountInr > 0) || !(rateUsd > 0) || !(inrPerUsd > 0) || !Number.isFinite(amountInr + rateUsd + inrPerUsd)) return null;
  const coins = amountInr / inrPerUsd / rateUsd;
  const low = roundTo(coins * (1 - RANGE_PERCENT / 100), option.decimals, "down");
  const high = roundTo(coins * (1 + RANGE_PERCENT / 100), option.decimals, "up");
  return { coin: option.coin, network: option.network, low, high, text: `You will get about ${low} to ${high} ${option.coin}` };
}

/** The range for a rupee amount in one coin, or null when the rate cannot be had (PassimPay down, coin not listed, rate 0). Never throws. */
export async function payoutEstimate(amountInr: number, coin: string, network: string): Promise<PayoutEstimate | null> {
  const option = findPayoutOption(coin, network);
  if (!option) return null;
  try {
    const entry = entryFor(await payoutCurrencies(), option);
    return entry ? estimateRange(amountInr, entry.rateUsd, option) : null;
  } catch {
    return null;
  }
}

/**
 * Before a crypto wallet is saved: the coin must be one PassimPay lists, and PassimPay must accept the address.
 * Skipped when PassimPay is not configured here (local development); production always has it.
 */
export async function assertPayoutWalletAllowed(input: { coin: string; network: string; walletAddress: string }): Promise<void> {
  const option = findPayoutOption(input.coin, input.network);
  if (!option) throw new ValidationError("Invalid request", { network: ["Choose a coin from the list"] });
  if (!passimpayConfigured()) return;
  let paymentId: number;
  try {
    paymentId = await resolvePaymentId(input.coin, input.network);
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new InternalError("Could not check the coin right now. Try again in a minute.");
  }
  let valid: boolean;
  try {
    valid = await passimpayValidateAddress({ paymentId, address: input.walletAddress });
  } catch {
    throw new InternalError("Could not check the wallet address right now. Try again in a minute.");
  }
  if (!valid) throw new ValidationError("Invalid request", { walletAddress: [`That is not a valid ${option.coin} address on ${option.network}`] });
}
