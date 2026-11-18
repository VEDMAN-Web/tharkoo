import Link from "next/link";
import type { ListingDoc } from "@/lib/models";
import { useT } from "@/components/help/UiTextProvider";
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
  const t = useT();
  return (
    <div className="tkp-fields" data-tk="review-step">
      <div className="tkp-review-card" data-tk="review-preview">
        <PostPreviewCard ad={ad} label={t("post.reviewStep.adLabel")} hasPhoto={hasPhoto} byline={byline} />
      </div>
      <dl className="tkp-summary">
        {rows.map((row) => (
          <div key={row.key} data-tk={`review-${row.key}`}>
            <dt>{row.label}</dt>
            <dd>
              <span className="tkp-summary-value">{row.value}</span>
              <button type="button" className="tkp-edit" data-tk={`edit-${row.key}`} aria-label={t("post.reviewStep.editAria", { label: row.label.toLowerCase() })} onClick={() => onEdit(row.step)}>
                {t("post.reviewStep.edit")}
              </button>
            </dd>
          </div>
        ))}
      </dl>
      <p className="tkp-note">{note}</p>
      {pay ? <div className="tkp-pay-slot" data-tk="pay-slot">{pay}</div> : null}
      <div className={`tkp-consent ${termsError ? "is-bad" : ""}`}>
        <input id="consent-terms" type="checkbox" className="tk-check" checked={terms} onChange={onTerms} aria-invalid={Boolean(termsError)} />
        <label htmlFor="consent-terms">
          {t("post.reviewStep.agreePrefix")}{" "}
          <Link href="/terms/" target="_blank" rel="noopener">{t("post.reviewStep.terms")}</Link> {t("post.reviewStep.and")}{" "}
          <Link href="/privacy/" target="_blank" rel="noopener">{t("post.reviewStep.privacy")}</Link>.
        </label>
        {termsError ? <span className="tk-error" data-tk="field-error">{termsError}</span> : null}
      </div>
      <div className={`tkp-consent ${adultError ? "is-bad" : ""}`}>
        <input id="consent-adult" type="checkbox" className="tk-check" checked={adult} onChange={onAdult} aria-invalid={Boolean(adultError)} />
        <label htmlFor="consent-adult">{t("post.reviewStep.adult")}</label>
        {adultError ? <span className="tk-error" data-tk="field-error">{adultError}</span> : null}
      </div>
    </div>
  );
}
