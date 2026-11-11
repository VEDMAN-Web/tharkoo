/** Site-level ordering settings. Pure: no database here. Defaults reproduce the original order exactly. */

export const TIER_CODES = ["star", "super-top", "flash", "top", "highlight", "new", "auto-boost", "free"] as const;

export interface RankSettings {
  /** Strongest first. Ads with no active paid promotion sit at the position of "free". */
  tierOrder: readonly string[];
  verifiedFirst: boolean;
  photoFirst: boolean;
}

export const DEFAULT_RANK_SETTINGS: RankSettings = {
  tierOrder: TIER_CODES,
  verifiedFirst: true,
  photoFirst: false,
};

/** Accepts anything stored or posted; unknown codes are dropped, missing ones are appended in default order. */
export function normaliseRankSettings(input: unknown): RankSettings {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const seen = new Set<string>();
  const order: string[] = [];
  const given = Array.isArray(raw.tierOrder) ? raw.tierOrder : [];
  for (const entry of [...given, ...TIER_CODES]) {
    const code = typeof entry === "string" ? entry.trim().toLowerCase() : "";
    if ((TIER_CODES as readonly string[]).includes(code) && !seen.has(code)) {
      seen.add(code);
      order.push(code);
    }
  }
  return {
    tierOrder: order,
    verifiedFirst: typeof raw.verifiedFirst === "boolean" ? raw.verifiedFirst : DEFAULT_RANK_SETTINGS.verifiedFirst,
    photoFirst: typeof raw.photoFirst === "boolean" ? raw.photoFirst : DEFAULT_RANK_SETTINGS.photoFirst,
  };
}
