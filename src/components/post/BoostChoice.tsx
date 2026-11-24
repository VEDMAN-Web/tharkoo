"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/help/UiTextProvider";
import { PlanChoice } from "@/components/promote/PlanChoice";
import { api } from "@/lib/ui/api";
import "@/components/promote/promote.css";

export type BoostPlan = { id: string; code: string; name: string; description: string; amount: number; durationHours?: number };
export type BoostChoiceValue = { plan: BoostPlan | null; balance: number | null };

/** The plans a new ad can start with. Everything else (Star, Flash, Bump...) stays in the Promote pop-up. */
export const START_PLAN_CODES = ["top", "super-top"] as const;

/** What the whole post costs in ad credits: the posting fee (when posting is paid and this is not an edit) plus the plan. */
export function adCreditsNeeded(input: { fee: number; plan: Pick<BoostPlan, "amount"> | null }): number {
  return Math.max(0, input.fee) + (input.plan ? Math.max(0, input.plan.amount) : 0);
}

/** How many ad credits are missing for that cost. Zero when the balance is not known (the server then decides). */
export function adCreditsShort(need: number, balance: number | null): number {
  return balance === null ? 0 : Math.max(0, need - balance);
}

/**
 * H19.6b: step 8. Free, TOP or Super Top, each with an (i) that says what it does and what it costs in ad credits.
 * The choice and the ad-credit balance go up to the form; publishing does the charge.
 */
export function BoostChoice({ fee, onChange }: { fee: number; onChange: (value: BoostChoiceValue) => void }) {
  const t = useT();
  const [plans, setPlans] = useState<BoostPlan[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([api<{ products: BoostPlan[] }>("/api/promotions/products"), api<{ balance: number }>("/api/wallet/")]).then(([products, wallet]) => {
      if (!live) return;
      const list = products.ok ? (products.data.products || []).filter((plan) => (START_PLAN_CODES as readonly string[]).includes(plan.code) && plan.amount > 0) : [];
      setPlans(list.sort((a, b) => a.amount - b.amount));
      setBalance(wallet.ok ? Number(wallet.data.balance) || 0 : null);
    });
    return () => {
      live = false;
    };
  }, []);

  const plan = plans?.find((item) => item.id === picked) ?? null;
  useEffect(() => {
    onChange({ plan, balance });
  }, [plan, balance, onChange]);
  // Leaving the step forgets the choice, so the form never publishes a boost the person no longer sees.
  useEffect(() => () => onChange({ plan: null, balance: null }), [onChange]);

  if (!plans || plans.length === 0) return null;
  const short = adCreditsShort(adCreditsNeeded({ fee, plan }), balance);
  const credits = (count: number) => t("post.boost.price", { count });
  return (
    <section className="tkp-boost" data-tk="boost-choice" aria-label={t("post.boost.title")}>
      <h2 className="tkp-boost-title">{t("post.boost.title")}</h2>
      <div role="radiogroup" aria-label={t("post.boost.title")} className="tkpr-plans tkp-boost-plans">
        <PlanChoice id="free" name={t("post.boost.free")} price={t("post.boost.freePrice")} text={t("post.boost.freeText")} tip={t("post.boost.freeTip")} selected={picked === ""} onSelect={() => setPicked("")} />
        {plans.map((item) => (
          <PlanChoice
            key={item.id}
            id={item.code}
            name={item.name}
            price={credits(item.amount)}
            text={item.description}
            tip={`${item.description} ${t("post.boost.costs", { count: item.amount })}`}
            selected={picked === item.id}
            onSelect={() => setPicked(item.id)}
          />
        ))}
      </div>
      {balance !== null ? <p className="tkp-boost-balance" data-tk="boost-balance">{t("post.boost.balance", { count: balance })}</p> : null}
      {short > 0 ? <p className="tkp-boost-short" role="alert" data-tk="boost-short">{t("post.boost.short", { count: short })}</p> : null}
    </section>
  );
}
