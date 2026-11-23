/** The pop-out of an ad card never leaves the window: its top is pulled up (or down) until the whole box is inside. */
export const POP_EDGE_PX = 8;

export function clampPopTop(wanted: number, height: number, viewportHeight: number, edge = POP_EDGE_PX): number {
  const lowest = viewportHeight - height - edge;
  return Math.max(edge, Math.min(wanted, lowest));
}

export function clampPopLeft(wanted: number, width: number, viewportWidth: number, edge = POP_EDGE_PX): number {
  return Math.max(edge, Math.min(wanted, viewportWidth - width - edge));
}

/** The tallest the box may be: the window height less the margin on both sides. */
export function popMaxHeight(viewportHeight: number, edge = POP_EDGE_PX): number {
  return Math.max(0, viewportHeight - edge * 2);
}
