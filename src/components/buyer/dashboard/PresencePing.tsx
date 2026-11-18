"use client";

import { usePresenceActivity } from "@/components/vendor/AvailabilityControls";

/** H14.3: the switches moved to Settings, but being active on the dashboard still keeps a seller shown as Online now. */
export function PresencePing() {
  usePresenceActivity();
  return null;
}
