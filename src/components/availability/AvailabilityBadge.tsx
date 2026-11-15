import type { PresenceStatus } from "@/server/availability/status";
import { statusLabel } from "@/server/availability/status";

/**
 * H7.5: the "Online now" / "Away" badge. Used by the vendor panel now; the ad page and the listing cards use the same
 * badge once their owner's status is passed in (see docs/claude/STATUS.md for the wiring still to do).
 */
export function AvailabilityBadge({ status }: { status: PresenceStatus }) {
  const online = status === "online";
  return (
    <span className={`tkp-avail-badge ${online ? "is-online" : "is-away"}`} data-tk="availability" data-status={status}>
      <span className="tkp-avail-dot" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
