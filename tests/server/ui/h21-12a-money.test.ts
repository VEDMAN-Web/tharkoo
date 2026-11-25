import { describe, expect, it } from "vitest";
import { costBox, feeNote, formatPhone, freeLeftText, publishLabel, type ThisAdMoney } from "@/components/post/money-text";
import { makeT } from "@/lib/ui/text";

const t = makeT({});
const used: ThisAdMoney = { paidOn: true, fee: 20, quota: { left: 0, total: 3 } };
const free: ThisAdMoney = { paidOn: true, fee: 0, quota: { left: 2, total: 3 } };

describe("H21.12a: no free ads left", () => {
  it("says the cost and that the free ads are used", () => {
    expect(feeNote(t, used)).toBe("This ad costs 20 credits. You have used your 3 free ads.");
    expect(feeNote(t, { ...used, fee: 35, quota: { left: 0, total: 5 } })).toBe("This ad costs 35 credits. You have used your 5 free ads.");
    expect(feeNote(t, { ...used, quota: { left: 0, total: 1 } })).toBe("This ad costs 20 credits. You have used your free ad.");
    expect(freeLeftText(t, used)).toBe("");
  });

  it("shows the same number in the cost box and on the button, with and without a boost", () => {
    expect(costBox(t, { money: used, plan: null, balance: 140 })).toEqual({ posting: "20 credits", postingNote: "", boost: "0 credits", total: "20 credits", after: "120 credits" });
    expect(publishLabel(t, 20, "")).toBe("Publish · 20 credits");
    const top = costBox(t, { money: used, plan: { name: "TOP", amount: 45 }, balance: 140 });
    expect(top).toMatchObject({ boost: "TOP · 45 credits", total: "65 credits", after: "75 credits" });
    expect(publishLabel(t, 65, "TOP")).toBe("Publish with TOP · 65 credits");
  });

  it("does not invent a balance after when the balance is too low or unknown", () => {
    expect(costBox(t, { money: used, plan: null, balance: 5 }).after).toBe("Not enough credits");
    expect(costBox(t, { money: used, plan: null, balance: null }).after).toBe("");
  });
});

describe("H21.12a: free ads left", () => {
  it("says free with the count and costs 0 everywhere", () => {
    expect(feeNote(t, free)).toBe("This ad is free (2 of 3 free ads left)");
    expect(costBox(t, { money: free, plan: null, balance: 140 })).toEqual({ posting: "0 credits", postingNote: "(2 of 3 free ads left)", boost: "0 credits", total: "0 credits", after: "140 credits" });
    expect(publishLabel(t, 0, "")).toBe("Publish ad");
  });

  it("says nothing when posting is not paid", () => {
    expect(feeNote(t, { paidOn: false, fee: 0, quota: null })).toBe("");
  });
});

describe("H21.12a: the phone number reads as 5 and 5", () => {
  it("puts a space after the code and in the middle", () => {
    expect(formatPhone("+919000000000")).toBe("+91 90000 00000");
    expect(formatPhone("+9190000")).toBe("+9190000");
    expect(formatPhone("")).toBe("");
  });
});
