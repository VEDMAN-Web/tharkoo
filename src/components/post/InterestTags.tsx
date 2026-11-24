"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { InfoPopover } from "@/components/upload/InfoPopover";
import { addInterest, INTEREST_LENGTH_MAX, INTEREST_MAX } from "./interests";

/**
 * H19.6: an optional interest box. Type a word and press Enter: it becomes a chip with a remove button. Up to 5. The chips are
 * the answer, a list kept in the ad's details.
 */
export function InterestTags({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const full = value.length >= INTEREST_MAX;

  function commit() {
    const next = addInterest(value, typed);
    if (next.length !== value.length) onChange(next);
    setTyped("");
  }

  return (
    <div className="tkp-interest" data-tk="interest-tags">
      <div className="tkp-interest-head">
        <label htmlFor="interest-input" className="tkp-interest-label">{t("post.interest.label")}</label>
        <InfoPopover id="interest-info" label={t("post.interest.label")}>{t("post.interest.tip")}</InfoPopover>
        <span className="tkp-interest-count" aria-live="polite">{value.length} / {INTEREST_MAX}</span>
      </div>
      {value.length ? (
        <ul className="tkp-interest-chips" aria-label={t("post.interest.listLabel")}>
          {value.map((item) => (
            <li key={item} className="tkp-interest-chip" data-tk="interest-chip">
              <span>{item}</span>
              <button type="button" className="tkp-interest-x" aria-label={t("post.interest.remove", { name: item })} onClick={() => onChange(value.filter((other) => other !== item))}>
                <X size={14} aria-hidden="true" focusable="false" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id="interest-input"
        className="tkp-interest-input"
        type="text"
        value={typed}
        disabled={full}
        maxLength={INTEREST_LENGTH_MAX}
        placeholder={full ? t("post.interest.full") : t("post.interest.placeholder")}
        autoComplete="off"
        enterKeyHint="done"
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          // Enter adds the chip; it never moves on to the next step.
          event.preventDefault();
          event.stopPropagation();
          commit();
        }}
        onBlur={commit}
      />
    </div>
  );
}
