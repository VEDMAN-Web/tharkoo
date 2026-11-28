/** Profile photo rules, shared by the settings screen and the server. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_RULE = "Use a JPG, PNG or WebP photo up to 5 MB.";
/** The stored picture is a square this many pixels wide, saved as WebP. */
export const AVATAR_SIZE = 256;
/** Sent after the photo changes, with the new address (or null), so the header updates without a reload. */
export const AVATAR_EVENT = "tk:avatar-changed";
