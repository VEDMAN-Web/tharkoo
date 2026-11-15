import { describe, expect, it } from "vitest";
import { backspaceCode, clearCodeDigit, focusIndexAfterWrite, formatCountdown, indiaPhone, typedDigits, writeCodeDigits } from "@/components/auth/sign-in-input";

describe("code boxes (H7.12)", () => {
  it("keeps only the typed digit when a box already has one", () => {
    expect(typedDigits("2", "25")).toBe("5");
    expect(typedDigits("2", "52")).toBe("5");
    expect(typedDigits("", "123456")).toBe("123456");
    expect(typedDigits("", "")).toBe("");
  });

  it("writes digits from a box and never leaves a gap", () => {
    expect(writeCodeDigits("12", 0, "9")).toBe("92");
    expect(writeCodeDigits("12", 1, "5")).toBe("15");
    expect(writeCodeDigits("12", 2, "7")).toBe("127");
    expect(writeCodeDigits("1", 3, "4")).toBe("14");
  });

  it("takes a pasted code into the boxes and stops at six digits", () => {
    expect(writeCodeDigits("", 0, "123456")).toBe("123456");
    expect(writeCodeDigits("1", 1, "99999999")).toBe("199999");
  });

  it("moves focus to the next empty box after a write", () => {
    expect(focusIndexAfterWrite("", 0, "1")).toBe(1);
    expect(focusIndexAfterWrite("", 0, "123456")).toBe(5);
  });

  it("removes a digit and closes the gap, and Backspace steps back", () => {
    expect(clearCodeDigit("1234", 1)).toBe("134");
    expect(backspaceCode("12", 2)).toBe("1");
    expect(backspaceCode("12", 0)).toBe("12");
  });
});

describe("mobile number (H7.12)", () => {
  it("adds +91 to the ten digits typed", () => {
    expect(indiaPhone("98250 12345")).toBe("+919825012345");
    expect(indiaPhone("+91 98250-12345")).toBe("+919825012345");
    expect(indiaPhone("09825012345")).toBe("+919825012345");
  });
});

describe("resend countdown (H7.12)", () => {
  it("shows minutes and seconds", () => {
    expect(formatCountdown(30)).toBe("0:30");
    expect(formatCountdown(75)).toBe("1:15");
    expect(formatCountdown(0)).toBe("0:00");
  });
});
