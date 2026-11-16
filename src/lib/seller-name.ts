export const DEMO_SELLER_NAME = "Seed";
export const PUBLIC_DEMO_NAME = "Tharkoo member";

export function publicSellerName(name: string | null | undefined): string {
  const trimmed = (name || "").trim();
  return trimmed.toLowerCase() === DEMO_SELLER_NAME.toLowerCase() ? PUBLIC_DEMO_NAME : trimmed;
}
