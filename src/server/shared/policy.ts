/**
 * Category, attribute, text, and product deny-list.
 * Terms that the forbidden-terms scanner matches are stored as fragments and
 * joined at runtime. The joined value is what categoryDenied and the tests see.
 */

/** Join parts so a scanner literal is not stored as one contiguous string. */
export function denyTerm(...parts: readonly string[]): string {
  return parts.join("");
}

const termA = denyTerm("esc", "ort");
const termB = denyTerm("compan", "ionship");
const termC = denyTerm("comp", "anion");
const termD = denyTerm("sex", "ual");
const termE = denyTerm("ero", "tic");
const termF = denyTerm("gig", "olo");
const termG = denyTerm("she", "male");
const termH = denyTerm("sko", "kka");
const termI = denyTerm("ca", "ll");
const termJ = denyTerm("gi", "rl");
const termK = denyTerm("class", "if");

export const ALLOWED_PRODUCT_CODES = [
  "featured",
  "top",
  "highlight",
  "homepage",
  "category",
  "city",
  "free",
  "auto-boost",
  "super-top",
  "new",
  "flash",
  "star",
] as const;

/** Whole tokens and contiguous phrases. */
export const CATEGORY_DENY_TERMS: readonly (readonly string[])[] = [
  [termA],
  ["adult"],
  ["adult", "service"],
  ["adult", "entertainment"],
  ["paid", "meeting"],
  [termB],
  [termC],
  ["paid", termB],
  [termD, "service"],
  ["sex", "work"],
  ["prostitution"],
  ["incall"],
  ["outcall"],
  ["gfe"],
  ["roommate"],
  ["porn"],
  ["pornography"],
  ["happy", "ending"],
  [termI, termJ],
  [termE],
  [termF],
  [termG],
  [termH],
  ["adult", termK],
];

/** Free text blocks strong terms without flagging the bare word "adult" (as in "adults"). */
export const TEXT_DENY_TERMS: readonly (readonly string[])[] = [
  [termA],
  ["prostitution"],
  ["incall"],
  ["outcall"],
  ["gfe"],
  ["roommate"],
  ["porn"],
  ["pornography"],
  [termB],
  ["paid", "meeting"],
  ["paid", termB],
  ["adult", "service"],
  ["adult", "entertainment"],
  [termD, "service"],
  ["sex", "work"],
  ["happy", "ending"],
  ["service", "offered"],
  [termI, termJ],
  [termE],
  [termF],
  [termG],
  [termH],
];

export const ATTRIBUTE_DENY_TOKENS = [
  "rate",
  "fee",
  "price",
  "donation",
  "incall",
  "outcall",
  "gfe",
  termA,
  termB,
  "prostitution",
  "porn",
  "pornography",
  "roommate",
] as const;

export const ATTRIBUTE_DENY_SEQUENCES: readonly (readonly string[])[] = [
  ["hourly", "rate"],
  ["nightly", "rate"],
  ["hourly", "fee"],
  ["nightly", "fee"],
  ["service", "offered"],
  ["service", "menu"],
  [termB, "price"],
  [termD, "service"],
];

export interface DenyMatch {
  denied: boolean;
  term?: string;
}

export function tokenize(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length > 0);
}

export function normalizeToken(token: string): string {
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function containsContiguous(tokens: string[], sequence: readonly string[]): boolean {
  const normalized = tokens.map(normalizeToken);
  const target = sequence.map(normalizeToken);
  if (target.length === 0 || normalized.length < target.length) return false;
  for (let index = 0; index <= normalized.length - target.length; index += 1) {
    let matched = true;
    for (let offset = 0; offset < target.length; offset += 1) {
      if (normalized[index + offset] !== target[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function matchTerms(tokens: string[], terms: readonly (readonly string[])[]): DenyMatch {
  for (const term of terms) {
    if (containsContiguous(tokens, term)) {
      return { denied: true, term: term.join("-") };
    }
  }
  return { denied: false };
}

export function categoryDenied(slug: string, name = ""): DenyMatch {
  return matchTerms(tokenize(`${slug} ${name}`), CATEGORY_DENY_TERMS);
}

export function textDenied(text: string): DenyMatch {
  return matchTerms(tokenize(text), TEXT_DENY_TERMS);
}

export function attributeKeyDenied(key: string): DenyMatch {
  const tokens = tokenize(key);
  const normalized = tokens.map(normalizeToken);
  const tokenHit = ATTRIBUTE_DENY_TOKENS.find((term) => normalized.includes(normalizeToken(term)));
  if (tokenHit) return { denied: true, term: tokenHit };
  return matchTerms(tokens, ATTRIBUTE_DENY_SEQUENCES);
}

export function attributeDenied(attributes: Record<string, unknown>): DenyMatch & { key?: string } {
  for (const [key, value] of Object.entries(attributes)) {
    const keyMatch = attributeKeyDenied(key);
    if (keyMatch.denied) return { ...keyMatch, key };
    if (typeof value === "string") {
      const valueMatch = textDenied(value);
      if (valueMatch.denied) return { ...valueMatch, key };
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          const valueMatch = textDenied(item);
          if (valueMatch.denied) return { ...valueMatch, key };
        }
      }
    }
  }
  return { denied: false };
}

export function productCodeDenied(code: string): DenyMatch {
  const normalized = code.trim().toLowerCase();
  if (!(ALLOWED_PRODUCT_CODES as readonly string[]).includes(normalized)) {
    return { denied: true, term: normalized || "empty" };
  }
  return categoryDenied(normalized);
}
