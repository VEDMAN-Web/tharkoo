"use client";

import { useState, type DragEvent } from "react";

/**
 * Drag-to-reorder for rows. Only the handle is draggable (so text inside inputs stays selectable);
 * the whole row is the drop target. Up and down buttons are still offered for keyboard and phone use.
 */
export function useDragRows(onMove: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const end = () => {
    setFrom(null);
    setOver(null);
  };
  return {
    over,
    handleProps: (index: number) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.setData("text/plain", String(index));
        event.dataTransfer.effectAllowed = "move";
        const row = event.currentTarget.closest("[data-drag-row]");
        if (row) event.dataTransfer.setDragImage(row, 0, 0);
        setFrom(index);
      },
      onDragEnd: end,
    }),
    rowProps: (index: number) => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (from === null) return;
        event.preventDefault();
        setOver(index);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        if (from !== null && from !== index) onMove(from, index);
        end();
      },
    }),
  };
}
