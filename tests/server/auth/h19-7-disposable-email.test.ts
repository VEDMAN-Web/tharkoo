import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isDisposableEmail } from "@/server/auth/disposable-email";
import { EmailLoginChallenge, sendEmailLoginCode } from "@/server/auth/email-code";
import { registerUser } from "@/server/auth/service";
import { ValidationError } from "@/server/http";
import { User } from "@/server/models";
import { TEXT_DEFAULTS } from "@/lib/ui/text";
import { clearMemoryMongo, connectMemoryMongo, disconnectMemoryMongo } from "../../setup/mongo";

/** H19.7: throwaway email addresses are refused for login codes and sign-ups; nothing is sent. */

const mail = vi.hoisted(() => ({ sent: [] as string[] }));
vi.mock("@/server/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/mailer")>();
  return {
    ...actual,
    deliverLoginCodeEmail: async (to: string) => {
      mail.sent.push(to);
      return true;
    },
  };
});

const MESSAGE = "Please use your own email address.";

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  delete process.env.MONGODB_URI;
  await connectMemoryMongo();
});
afterAll(async () => {
  await disconnectMemoryMongo();
});
beforeEach(async () => {
  await clearMemoryMongo();
  mail.sent = [];
});

describe("isDisposableEmail", () => {
  it("knows the common throwaway domains", () => {
    for (const domain of ["yopmail.com", "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org", "sharklasers.com", "trashmail.com", "getnada.com", "maildrop.cc"]) {
      expect(isDisposableEmail(`someone@${domain}`), domain).toBe(true);
    }
  });

  it("also blocks subdomains of a listed domain", () => {
    expect(isDisposableEmail("a@inbox.mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@x.y.yopmail.com")).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(isDisposableEmail("  Someone@YOPMAIL.COM ")).toBe(true);
    expect(isDisposableEmail("A@Mailinator.Com")).toBe(true);
  });

  it("lets normal providers through, and does not match a longer name that merely ends the same", () => {
    for (const email of ["a@gmail.com", "a@outlook.com", "a@yahoo.in", "a@example.org", "a@notmailinator.com", "a@mailinator.com.example.org", "a@my-yopmail.com"]) {
      expect(isDisposableEmail(email), email).toBe(false);
    }
  });

  it("has nothing to say about text that is not an address", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("no-at-sign")).toBe(false);
  });
});

describe("the login code path", () => {
  it("refuses a throwaway address with the plain message, creates no challenge and sends no email", async () => {
    const error = await sendEmailLoginCode({ email: "Test@YopMail.com", ip: "198.51.100.1" }).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(String(error.message)).toBe(MESSAGE);
    expect(await EmailLoginChallenge.countDocuments({})).toBe(0);
    expect(mail.sent).toEqual([]);
  });

  it("still sends a code to a normal address", async () => {
    expect(await sendEmailLoginCode({ email: "real.person@gmail.com", ip: "198.51.100.2" })).toEqual({ ok: true });
    expect(mail.sent).toEqual(["real.person@gmail.com"]);
  });
});

describe("the sign-up path", () => {
  const base = { password: "password123", displayName: "Ravi", dateOfBirth: "1990-01-01", acceptedTerms: true as const, attestedAdult: true as const };

  it("refuses a throwaway address and creates no account", async () => {
    const error = await registerUser({ ...base, email: "ravi@sub.mailinator.com" }).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(String(error.message)).toBe(MESSAGE);
    expect(await User.countDocuments({})).toBe(0);
  });

  it("still signs up a normal address", async () => {
    process.env.STAGING_AUTO_VERIFY_EMAIL = "false";
    const out = await registerUser({ ...base, email: "ravi@outlook.com" });
    expect(out.userId).toBeTruthy();
  });
});

describe("the message", () => {
  it("is a Site text key (Help texts), default exactly as asked", () => {
    expect(TEXT_DEFAULTS["help.email.ownAddress"]).toBe(MESSAGE);
  });
});
