import { creditsText, rupeesText } from "./credits";

type CardProps = { fee: number; price?: number; balance: number | null; ready: boolean; onTopUp: () => void };

export function CreditsCard({ fee, price, balance, ready, onTopUp }: CardProps) {
  if (ready && balance === null) {
    return (
      <div className="tkp-credits" data-tk="credits-card">
        <p className="tkp-credits-line">Posting an ad costs {creditsText(fee)} ({rupeesText(fee, price)})</p>
      </div>
    );
  }
  return (
    <div className="tkp-credits" data-tk="credits-card">
      <p className="tkp-credits-title">Credits</p>
      <p className="tkp-credits-line" data-tk="credits-balance">Balance {balance === null ? "..." : creditsText(balance)}</p>
      <p className="tkp-credits-line">{fee > 0 ? `This ad: ${creditsText(fee)}` : "Changes to this ad: no charge"}</p>
      {fee > 0 ? <button type="button" className="tkp-credits-link" data-tk="credits-topup" onClick={onTopUp}>Top up</button> : null}
    </div>
  );
}

type PayProps = { fee: number; balance: number | null; short: number; onRecharge: () => void };

export function PayCard({ fee, balance, short, onRecharge }: PayProps) {
  const low = short > 0;
  return (
    <section className={`tkp-pay ${low ? "is-low" : ""}`} data-tk="pay-card" data-state={low ? "low" : "ok"} aria-label="Pay and publish">
      <h2 className="tkp-pay-title">Pay and publish</h2>
      <dl className="tkp-pay-rows">
        <div><dt>Ad posting fee</dt><dd data-tk="pay-fee">{creditsText(fee)}</dd></div>
        <div><dt>Your balance</dt><dd data-tk="pay-balance">{balance === null ? "..." : creditsText(balance)}</dd></div>
        {low ? null : <div><dt>After posting</dt><dd data-tk="pay-after">{creditsText((balance ?? 0) - fee)}</dd></div>}
      </dl>
      {low ? (
        <p className="tkp-pay-note" role="alert" id="pay-reason" data-tk="pay-short">
          You need {short} more {short === 1 ? "credit" : "credits"} to publish.{" "}
          <button type="button" className="tkp-credits-link" onClick={onRecharge}>Recharge now</button>
        </p>
      ) : null}
    </section>
  );
}
