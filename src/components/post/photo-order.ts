/** H21.3: the pure parts of dragging a photo to a new place: the new order, and which place a pointer is over. */

export const LONG_PRESS_MS = 250;
/** How far a finger may wander during the long press before it counts as a scroll. */
export const PRESS_SLOP_PX = 8;
/** How far a mouse moves with the button down before it counts as a drag. */
export const DRAG_START_PX = 5;

/** A copy of the list with the item at `from` moved to `to` (both clamped to the list). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.min(Math.max(to, 0), next.length), 0, item);
  return next;
}

export type Box = { left: number; top: number; right: number; bottom: number };

/** The index of the box the point is over; when it is over none, the nearest box by its centre. -1 for an empty list. */
export function indexAt(boxes: readonly Box[], x: number, y: number): number {
  if (!boxes.length) return -1;
  const inside = boxes.findIndex((box) => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
  if (inside >= 0) return inside;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  boxes.forEach((box, index) => {
    const dx = (box.left + box.right) / 2 - x;
    const dy = (box.top + box.bottom) / 2 - y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
