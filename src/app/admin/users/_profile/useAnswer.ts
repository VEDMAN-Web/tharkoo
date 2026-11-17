"use client";

import { useRouter } from "next/navigation";
import { undoAction } from "@/app/admin/undo-actions";
import { useToast } from "@/components/admin/ui";
import type { ProfileResult } from "./actions";

/** Shows what happened as a toast (with Undo while the change can be undone) and refreshes the drawer. Returns true when it worked. */
export function useAnswer() {
  const toast = useToast();
  const router = useRouter();
  return function answer(result: ProfileResult, what: string): boolean {
    if (!result.ok) {
      toast.show({ kind: "error", message: result.message });
      return false;
    }
    const eventId = result.eventId;
    if (result.undoUntil && eventId) {
      toast.show({
        kind: "undo",
        message: result.summary,
        onUndo: async () => {
          const outcome = await undoAction(eventId);
          toast.show({ kind: outcome.ok ? "success" : "error", message: outcome.ok ? `${what} undone.` : outcome.message });
          router.refresh();
        },
      });
    } else {
      toast.show({ kind: "success", message: result.summary });
    }
    router.refresh();
    return true;
  };
}
