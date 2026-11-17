/** The undo windows and their words, as plain data for the admin page (H8.25). Defaults match the server (days). */

export const UNDO_WINDOW_KEYS = ["edits", "decisions", "credits", "demo", "settings"] as const;
export type UndoWindowName = (typeof UNDO_WINDOW_KEYS)[number];
export type UndoWindows = Record<UndoWindowName, number>;

export const UNDO_WINDOW_LABELS: Record<UndoWindowName, string> = {
  edits: "Ad edits",
  decisions: "Approve, reject, remove, bans and ID decisions",
  credits: "Credits added or removed by staff",
  demo: "Ended demo ads",
  settings: "Settings, menus, prices and site text",
};
