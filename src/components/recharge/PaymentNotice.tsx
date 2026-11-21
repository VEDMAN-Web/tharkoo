import "./recharge.css";
/** H18.1: the line shown on the credits page after the buyer comes back from the payment page (the words are Site text). */
export function PaymentNotice({ text, kind }: { text: string; kind: "success" | "failed" }) {
  return (
    <p role="status" className="tkr-notice" data-tk="payment-notice" data-kind={kind}>
      {text}
    </p>
  );
}
