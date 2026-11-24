"use client";

import { InfoPopover } from "@/components/upload/InfoPopover";

/**
 * H19.6b: one choice card (Free, TOP, Super Top and the other plans): the name, the price in ad credits, one line, and an (i) that
 * says what it does. The same card is used on the last step of Post an ad and in the Promote pop-up.
 */
export function PlanChoice({
  id,
  name,
  price,
  text,
  extra,
  tip,
  selected,
  onSelect,
}: {
  id: string;
  name: string;
  price: string;
  text: string;
  extra?: string;
  tip: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="tkpr-row" data-tk="plan-row" data-selected={selected ? "true" : "false"}>
      <button type="button" role="radio" aria-checked={selected} className="tkpr-plan" data-tk="promote-plan" data-code={id} onClick={onSelect}>
        <span className="tkpr-plan-top">
          <span className="tkpr-plan-name">{name}</span>
          <span className="tkpr-plan-price">{price}</span>
        </span>
        <span className="tkpr-plan-text">{text}</span>
        {extra ? <span className="tkpr-plan-days">{extra}</span> : null}
      </button>
      <span className="tkpr-info">
        <InfoPopover id={`plan-${id}`} label={name}>{tip}</InfoPopover>
      </span>
    </div>
  );
}
