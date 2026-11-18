"use client";

import { CreditPacksPanel } from "@/components/recharge/CreditPacks";

/** H9.1: the credit packs on the Account home and the credits page. It is the same picker the wallet and the posting sheet use. */
export function PackPicker({ returnTo = "/u/account/credits/", withPrices = false }: { returnTo?: string; withPrices?: boolean }) {
  return <CreditPacksPanel returnTo={returnTo} withPrices={withPrices} />;
}
