"use client";

import { useRouter } from "next/navigation";
import { undoAction } from "@/app/admin/undo-actions";
import { useToast } from "@/components/admin/ui";
import type { PriceResult } from "../_actions/actions";

/** Shows what a save did: an Undo toast for 10 s (UI-RULES section 3), or the error in red. Undo restores from the saved values only. */
export function useAnswer() {
  const toast = useToast();
  const router = useRouter();

  async function undo(eventId: string) {
    const outcome = await undoAction(eventId);
    toast.show(outcome.ok ? { kind: "success", message: "Change undone." } : { kind: "error", message: outcome.message });
    router.refresh();
  }

  return function answer(result: PriceResult, message: string): boolean {
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return false;
    }
    if (result.eventId) toast.show({ kind: "undo", message, onUndo: () => void undo(result.eventId) });
    else toast.show({ kind: "success", message });
    router.refresh();
    return true;
  };
}
