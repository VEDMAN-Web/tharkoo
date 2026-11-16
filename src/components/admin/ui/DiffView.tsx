import "@/styles/admin-kit.css";
import type { DiffRow } from "./kit-helpers";

/** Field-level before and after (UI-RULES: history and restore). Removed text is struck red, new text is green. */
export function DiffView({ rows, labels = {}, empty = "No differences." }: { rows: DiffRow[]; labels?: Record<string, string>; empty?: string }) {
  if (rows.length === 0) return <p className="adm-k-help" data-tk="diff-empty">{empty}</p>;
  return (
    <dl className="adm-k-diff" data-tk="diff">
      {rows.map((row) => (
        <div key={row.path} className="adm-k-diff-row" data-kind={row.kind}>
          <dt>{labels[row.path] ?? row.path}</dt>
          <dd>
            {row.kind !== "added" ? <del>{row.before || "empty"}</del> : null}{" "}
            {row.kind !== "removed" ? <ins>{row.after || "empty"}</ins> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
