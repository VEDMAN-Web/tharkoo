import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { PostPreviewCard } from "./PostPreview";

export type ReviewRow = { key: string; label: string; value: string; step: number };

type Props = {
  rows: ReviewRow[];
  ad: ListingDoc;
  hasPhoto: boolean;
  byline: string;
  note: string;
  pay?: React.ReactNode;
  terms: boolean;
  adult: boolean;
  termsError?: string;
  adultError?: string;
  onEdit: (step: number) => void;
  onTerms: () => void;
  onAdult: () => void;
};

export function ReviewStep({ rows, ad, hasPhoto, byline, note, pay, terms, adult, termsError, adultError, onEdit, onTerms, onAdult }: Props) {
  return (
    <div className="tkp-fields" data-tk="review-step">
      <div className="tkp-review-card" data-tk="review-preview">
        <PostPreviewCard ad={ad} label="Your ad" hasPhoto={hasPhoto} byline={byline} />
      </div>
      <dl className="tkp-summary">
        {rows.map((row) => (
          <div key={row.key} data-tk={`review-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>
              <span className="tkp-summary-value">{row.value}</span>
              <button type="button" className="tkp-edit" data-tk={`edit-${row.key}`} aria-label={`Edit ${row.label.toLowerCase()}`} onClick={() => onEdit(row.step)}>
                Edit
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="tkp-note">{note}</p>
      {pay}
      <div className={`tkp-consent ${termsError ? "is-bad" : ""}`}>
        <input id="consent-terms" type="checkbox" className="tk-check" checked={terms} onChange={onTerms} aria-invalid={Boolean(termsError)} />
        <label htmlFor="consent-terms">
          I agree to the{" "}
          <Link href="/terms/" target="_blank" rel="noopener">Terms and Conditions</Link> and the{" "}
          <Link href="/privacy/" target="_blank" rel="noopener">Privacy Policy</Link>.
        </label>
        {termsError ? <span className="tk-error" data-tk="field-error">{termsError}</span> : null}
      </div>
      <div className={`tkp-consent ${adultError ? "is-bad" : ""}`}>
        <input id="consent-adult" type="checkbox" className="tk-check" checked={adult} onChange={onAdult} aria-invalid={Boolean(adultError)} />
        <label htmlFor="consent-adult">I am 18 or over, the details in this ad are true, and I own the rights to any photos I added.</label>
        {adultError ? <span className="tk-error" data-tk="field-error">{adultError}</span> : null}
      </div>
    </div>
  );
}
