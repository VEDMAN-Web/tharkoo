import "@/styles/admin-kit.css";

export type BadgeTone = "ok" | "warn" | "bad" | "info" | "pri" | "neutral";

/** A status badge: one palette, six meanings (UI-RULES section 7). The text is always inside, never colour alone. */
export function Badge({ tone = "neutral", dot = false, children }: { tone?: BadgeTone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`adm-k-badge${tone === "neutral" ? "" : ` adm-k-badge-${tone}`}`}>
      {dot ? <i aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
