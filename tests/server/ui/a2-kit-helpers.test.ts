import { describe, expect, it } from "vitest";
import { buttonClass } from "@/components/admin/ui/Button";
import {
  BOTTOM_BAR_MAX,
  SUCCESS_TOAST_MS,
  UNDO_TOAST_MS,
  bottomBarItems,
  countdownSeconds,
  moveItem,
  opensDialog,
  toastDuration,
  toastRemaining,
  typedConfirmMatches,
  validateReason,
} from "@/components/admin/ui/kit-helpers";

describe("toast timer", () => {
  it("lasts 10 s for undo, 4 s for success, and never ends by itself for an error", () => {
    expect(toastDuration("undo")).toBe(UNDO_TOAST_MS);
    expect(UNDO_TOAST_MS).toBe(10_000);
    expect(toastDuration("success")).toBe(SUCCESS_TOAST_MS);
    expect(SUCCESS_TOAST_MS).toBe(4_000);
    expect(toastDuration("error")).toBeNull();
  });

  it("counts the time left from the time it was not paused", () => {
    expect(toastRemaining(10_000, 0)).toBe(10_000);
    expect(toastRemaining(10_000, 3_200)).toBe(6_800);
    expect(toastRemaining(10_000, 12_000)).toBe(0);
    expect(toastRemaining(10_000, -5)).toBe(10_000);
    expect(toastRemaining(null, 99_999)).toBeNull();
  });

  it("shows whole seconds rounded up, and 0 only when the time is gone", () => {
    expect(countdownSeconds(10_000)).toBe(10);
    expect(countdownSeconds(9_001)).toBe(10);
    expect(countdownSeconds(200)).toBe(1);
    expect(countdownSeconds(0)).toBe(0);
  });
});

describe("reason validation", () => {
  const base = { reasons: ["Spam", "Fake ads", "Other"], requireReason: true, requireText: false, pickedReason: "", text: "" };

  it("asks for a reason from the list when one is required", () => {
    const result = validateReason(base);
    expect(result.ok).toBe(false);
    expect(result.errors.reason).toBe("Choose a reason.");
    expect(validateReason({ ...base, pickedReason: "Spam" }).ok).toBe(true);
  });

  it("refuses a reason that is not on the list", () => {
    expect(validateReason({ ...base, pickedReason: "Because" }).errors.reason).toBeDefined();
  });

  it("needs free text after Other, and when the text is required", () => {
    expect(validateReason({ ...base, pickedReason: "Other" }).errors.text).toBe("Write at least 3 characters.");
    expect(validateReason({ ...base, pickedReason: "Other", text: "  ok " }).ok).toBe(false);
    expect(validateReason({ ...base, pickedReason: "Other", text: "Looks like junk" }).ok).toBe(true);
    expect(validateReason({ reasons: [], requireReason: false, requireText: true, pickedReason: "", text: "" }).errors.text).toBeDefined();
  });

  it("allows no reason at all when none is asked for", () => {
    expect(validateReason({ reasons: [], requireReason: false, requireText: false, pickedReason: "", text: "" }).ok).toBe(true);
  });

  it("needs the exact typed words for a bulk change", () => {
    const check = { reasons: [], requireReason: false, requireText: false, pickedReason: "", text: "", typedConfirm: "END DEMO" };
    expect(validateReason({ ...check, typed: "end demo" }).errors.typed).toBe("Type END DEMO to confirm.");
    expect(validateReason({ ...check, typed: "END DEMO" }).ok).toBe(true);
    expect(validateReason({ ...check, typed: "  END DEMO " }).ok).toBe(true);
    expect(typedConfirmMatches("", "")).toBe(false);
  });
});

describe("small helpers", () => {
  it("keeps the phone bottom bar to 5 items", () => {
    expect(BOTTOM_BAR_MAX).toBe(5);
    expect(bottomBarItems([1, 2, 3, 4, 5, 6, 7])).toEqual([1, 2, 3, 4, 5]);
    expect(bottomBarItems([1, 2])).toEqual([1, 2]);
  });

  it("moves one item up or down and leaves the list alone at the ends", () => {
    const list = ["a", "b", "c"];
    expect(moveItem(list, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(list, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(list, 0, -1)).toEqual(list);
    expect(moveItem(list, 2, 1)).toEqual(list);
    expect(moveItem(list, 9, 1)).toEqual(list);
    expect(list).toEqual(["a", "b", "c"]);
  });

  it("knows a label that ends with an ellipsis opens a dialog first", () => {
    expect(opensDialog("Reject...")).toBe(true);
    expect(opensDialog("Reject…")).toBe(true);
    expect(opensDialog("Approve")).toBe(false);
  });

  it("builds the button classes for each kind", () => {
    expect(buttonClass({})).toBe("adm-k-btn");
    expect(buttonClass({ kind: "primary" })).toBe("adm-k-btn adm-k-btn-primary");
    expect(buttonClass({ kind: "danger-solid", size: "sm" })).toBe("adm-k-btn adm-k-btn-danger-solid adm-k-btn-sm");
    expect(buttonClass({ kind: "quiet", icon: true })).toBe("adm-k-btn adm-k-btn-quiet adm-k-btn-icon");
  });
});
