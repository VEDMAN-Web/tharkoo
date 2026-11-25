"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useT } from "@/components/help/UiTextProvider";
import { addInterest, INTEREST_LENGTH_MAX, INTEREST_MAX } from "./interests";

/**
 * H19.6 / H21.2: the interests of the ad. Type a word and press Enter: it becomes a chip with a remove button. Up to 5.
 * "Popular:" suggestions come from the category's own interest options; one tap adds one. The chips are the answer, a list kept in the ad's details.
 */
export function InterestTags({ value, popular = [], onChange }: { value: string[]; popular?: readonly string[]; onChange: (next: string[]) => void }) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const full = value.length >= INTEREST_MAX;
  const suggestions = popular.filter((item) => !value.some((chosen) => chosen.toLowerCase() === item.toLowerCase())).slice(0, 6);

  function commit() {
    const next = addInterest(value, typed);
    if (next.length !== value.length) onChange(next);
    setTyped("");
  }

  return (
    <div className="tkd-int tkp-interest" data-tk="interest-tags">
      <div className="tkd-lbl" id="interest-label">
        <span>
          {t("post.v2.det.interests")} <span className="tkd-opt-note">{t("post.v2.det.interestsHint", { max: INTEREST_MAX })}</span>
        </span>
        <span className="tkd-count" aria-live="polite">{value.length} / {INTEREST_MAX}</span>
      </div>
      {value.length ? (
        <ul className="tkd-chips" aria-labelledby="interest-label">
          {value.map((item) => (
            <li key={item} className="tkd-chip" data-tk="interest-chip">
              <span>{item}</span>
              <button type="button" aria-label={t("post.interest.remove", { name: item })} onClick={() => onChange(value.filter((other) => other !== item))}>
                <X size={14} aria-hidden="true" focusable="false" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        id="interest-input"
        className="tkd-inp"
        type="text"
        value={typed}
        disabled={full}
        maxLength={INTEREST_LENGTH_MAX}
        aria-label={t("post.v2.det.interestsAdd")}
        placeholder={full ? t("post.interest.full") : t("post.v2.det.interestsPlaceholder")}
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
      {suggestions.length && !full ? (
        <div className="tkd-chips tkd-popular" data-tk="interest-popular">
          <span className="tkd-hint-inline">{t("post.v2.det.popular")}</span>
          {suggestions.map((item) => (
            <button key={item} type="button" className="tkd-chip-add" onClick={() => onChange(addInterest(value, item))}>
              <Plus size={14} aria-hidden="true" focusable="false" />
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
