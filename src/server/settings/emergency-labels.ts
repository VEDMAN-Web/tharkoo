/** The switches, their words and the messages people see. Plain data, so the admin page can import it without any server code (H8.25). */

export const EMERGENCY_KEYS = ["holdNewAds", "pauseNewAccounts24h", "pausePaidPosting", "pausePurchases", "pauseVideoCalls"] as const;
export type EmergencyKey = (typeof EMERGENCY_KEYS)[number];
export type EmergencyState = Record<EmergencyKey, boolean>;

export const EMERGENCY_LABELS: Record<EmergencyKey, { title: string; hint: string; confirm: string }> = {
  holdNewAds: { title: "Hold every new ad for review", hint: "Normally only flagged ads wait. Use during a spam wave.", confirm: "Every new ad will wait in Ads to review until someone approves it." },
  pauseNewAccounts24h: { title: "Pause posting for accounts younger than 24 hours", hint: "Older accounts can still post.", confirm: "Accounts less than 24 hours old will be refused when they try to post." },
  pausePaidPosting: { title: "Pause paid posting", hint: "While paid posting is on, new ads cannot be posted until this is off. Live ads are not touched.", confirm: "Nobody can post a new ad until you turn this off." },
  pausePurchases: { title: "Pause recharges", hint: "Shows \"Recharges are paused for a short time\" when someone tries to buy credits or a promotion.", confirm: "Nobody can recharge or buy a promotion until you turn this off." },
  pauseVideoCalls: { title: "Pause video calls", hint: "New video tour requests are refused. Tours already booked are not touched.", confirm: "Nobody can request a new video tour until you turn this off." },
};

/** What a person sees when a pause stops them. Plain words, no blame. */
export const PAUSE_MESSAGES: Record<Exclude<EmergencyKey, "holdNewAds">, string> = {
  pauseNewAccounts24h: "New accounts cannot post ads for their first 24 hours right now. Please try again later.",
  pausePaidPosting: "Posting new ads is paused for a short time. Please try again later.",
  pausePurchases: "Recharges are paused for a short time. Please try again later.",
  pauseVideoCalls: "Video calls are paused for a short time. Please try again later.",
};

