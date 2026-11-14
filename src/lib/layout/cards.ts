/*
 * Category card photos (H6.13). Pure and client-safe: the block schema, the editor and the card renderers all read these.
 */

/** Which part of a card photo stays in view when the frame crops it. Centre is the default. */
export const CARD_FOCUS = ["center", "top", "bottom", "left", "right"] as const;
export type CardFocus = (typeof CARD_FOCUS)[number];

/** Image sizes for a card photo: the full card width on phones (under 640 px), the 300 px card on wider screens. */
export const CARD_SIZES = "(max-width: 640px) 92vw, 300px";
