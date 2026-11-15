import type { ReactNode } from "react";
import "./reset-card.css";

/** H7.17: the 18a card around the password reset forms. */
export function ResetCard({ children }: { children: ReactNode }) {
  return (
    <div className="reset-page">
      <section className="reset-card">{children}</section>
    </div>
  );
}
