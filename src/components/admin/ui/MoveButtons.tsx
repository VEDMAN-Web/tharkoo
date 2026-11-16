"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import "@/styles/admin-kit.css";
import { buttonClass } from "./Button";

/** Move up and Move down: the single-pointer alternative to dragging (WCAG 2.2). Shown on every row, on a phone too. */
export function MoveButtons({
  name,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  /** What is being moved, for the label: "Home slot 3". */
  name: string;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <span className="adm-k-move" role="group" aria-label={`Move ${name}`}>
      <button type="button" className={buttonClass({ size: "sm", icon: true })} aria-label={`Move ${name} up`} title="Move up" disabled={!canUp} onClick={onUp}>
        <ArrowUp aria-hidden="true" focusable="false" />
      </button>
      <button type="button" className={buttonClass({ size: "sm", icon: true })} aria-label={`Move ${name} down`} title="Move down" disabled={!canDown} onClick={onDown}>
        <ArrowDown aria-hidden="true" focusable="false" />
      </button>
    </span>
  );
}
