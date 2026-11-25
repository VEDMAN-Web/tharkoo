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

/** H21.11: how far a list-row pop-out reaches past its row on every side. */
export const ROW_POP_GROW_PX = 12;

/**
 * H21.11: the box of a list-row pop-out. It covers its row completely: the row's left minus the grow, the row's width plus
 * twice the grow, and at least the row's height plus twice the grow. It still stays inside the window: when the row is wider
 * than the window less the edges, the box is the window width less the edges.
 */
export function rowPopBox(
  row: { left: number; width: number; height: number },
  viewportWidth: number,
  grow = ROW_POP_GROW_PX,
  edge = POP_EDGE_PX,
): { left: number; width: number; minHeight: number } {
  const width = Math.min(row.width + grow * 2, viewportWidth - edge * 2);
  return { left: clampPopLeft(row.left - grow, width, viewportWidth, edge), width, minHeight: row.height + grow * 2 };
}
