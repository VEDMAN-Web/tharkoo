/** Support ticket rules. Shared by the models, the services, the API routes and the screens. */

export const SUPPORT_TOPICS = ["coins_payments", "my_ads", "my_account", "report_problem", "something_else"] as const;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const TOPIC_LABELS: Record<SupportTopic, string> = {
  coins_payments: "Credits and payments",
  my_ads: "My ads",
  my_account: "My account",
  report_problem: "Report a problem",
  something_else: "Something else",
};

export const SUPPORT_STATUSES = ["open", "waiting_for_user", "waiting_for_support", "closed"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const STATUS_LABELS: Record<SupportStatus, string> = {
  open: "Open",
  waiting_for_user: "Waiting for you",
  waiting_for_support: "Waiting for support",
  closed: "Closed",
};

/** Staff roles that may work the desk: read, reply, add notes, assign, change status, close and reopen. */
export const DESK_ROLES = ["support", "moderator", "admin", "superadmin"] as const;

export const TICKET_OPEN_LIMIT = 5;
export const TICKET_REPLY_LIMIT = 20;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

export const SUBJECT_MAX = 120;
export const SUBJECT_MIN = 3;
export const BODY_MAX = 4000;
export const BODY_MIN = 10;

export const SCREENSHOT_MAX_COUNT = 3;
export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const SCREENSHOT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const SUPPORT_PAGE_SIZE = 50;
