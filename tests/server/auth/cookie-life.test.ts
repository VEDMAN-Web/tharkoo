import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE, SESSION_REMEMBER_MAX_AGE, maxAgeFor, sessionCookieHeader, sessionHintCookie } from "@/server/auth/http";

describe("session cookie lifetime (H7.12)", () => {
  it("keeps the standard 14-day cookie by default, so password login is unchanged", () => {
    expect(sessionCookieHeader("abc", false)).toContain(`Max-Age=${SESSION_MAX_AGE}`);
    expect(sessionHintCookie(false)).toContain(`Max-Age=${SESSION_MAX_AGE}`);
  });

  it("gives a 30-day cookie when Keep me logged in is ticked", () => {
    expect(SESSION_REMEMBER_MAX_AGE).toBe(60 * 60 * 24 * 30);
    expect(sessionCookieHeader("abc", false, "remembered")).toContain(`Max-Age=${SESSION_REMEMBER_MAX_AGE}`);
    expect(sessionHintCookie(false, "remembered")).toContain(`Max-Age=${SESSION_REMEMBER_MAX_AGE}`);
  });

  it("sets no Max-Age when Keep me logged in is unticked, so the cookie ends with the browser", () => {
    expect(maxAgeFor("browser")).toEqual([]);
    expect(sessionCookieHeader("abc", false, "browser")).not.toMatch(/Max-Age/);
    expect(sessionHintCookie(false, "browser")).not.toMatch(/Max-Age/);
    expect(sessionCookieHeader("abc", false, "browser")).toMatch(/HttpOnly/);
  });
});
