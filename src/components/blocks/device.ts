import type { BlockBase } from "@/server/models/layout";

/** CSS class that shows a block on phones only or desktops only (both or neither listed: no class). */
export function deviceClass(devices: BlockBase["devices"]) {
  if (!devices || devices.length !== 1) return undefined;
  return devices[0] === "mobile" ? "tk-only-mobile" : "tk-only-desktop";
}
