"use client";

import { CARD_WIDTH_LABELS, type CardWidth } from "@/server/listings/card-width-config";

/** H6.17: how wide the ad card list is on category and city pages. Phones are not affected. It is saved with the page layout (H8.55). */
export function CardWidthForm({ width, onChange }: { width: CardWidth; onChange: (next: CardWidth) => void }) {
  return (
    <section className="adm-card adm-lb-card" aria-labelledby="card-width-heading" data-tk="card-width-card">
      <h2 id="card-width-heading" className="t-h4">Card width</h2>
      <p className="adm-k-help">Width of the ad cards on category and city pages. The photo size does not change. Phones are not affected. It applies to all listing pages and goes live when you publish.</p>
      <fieldset className="adm-lb-radios">
        <legend className="adm-k-label">Card width</legend>
        {(Object.keys(CARD_WIDTH_LABELS) as CardWidth[]).map((option) => (
          <label key={option} className="t-small adm-lb-radio">
            <input type="radio" name="card-width" value={option} checked={width === option} onChange={() => onChange(option)} />
            {CARD_WIDTH_LABELS[option]}
          </label>
        ))}
      </fieldset>
    </section>
  );
}
