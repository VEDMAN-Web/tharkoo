import { Lock } from "lucide-react";
import "@/styles/admin-kit.css";

/** Shown instead of an Undo button for things that can never be undone: a lock and the reason (UI-RULES section 3). */
export function LockBadge({ reason }: { reason: string }) {
  return (
    <span className="adm-k-lock" data-tk="lock-badge">
      <Lock aria-hidden="true" focusable="false" />
      {reason}
    </span>
  );
}
