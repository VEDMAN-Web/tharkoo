"use client";

import { useRouter } from "next/navigation";
import { undoAction } from "@/app/admin/undo-actions";
import { useToast } from "@/components/admin/ui";
import type { SettingsResult } from "../_actions/actions";

/** Shows what a Settings save did: an Undo toast for 10 s, or the error in red. Undo restores from the saved values only. */
export function useAnswer() {
  const toast = useToast();
  const router = useRouter();

  async function undo(eventId: string, onUndone?: () => void) {
    const outcome = await undoAction(eventId);
    if (outcome.ok) onUndone?.();
    toast.show(outcome.ok ? { kind: "success", message: "Change undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  /** `onUndone` runs when the Undo worked, so a card can put its own box back at once. */
  return function answer(result: SettingsResult, message: string, onUndone?: () => void): boolean {
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return false;
    }
    if (result.eventId) toast.show({ kind: "undo", message, onUndo: () => void undo(result.eventId, onUndone) });
    else toast.show({ kind: "success", message });
    router.refresh();
    return true;
  };
}
