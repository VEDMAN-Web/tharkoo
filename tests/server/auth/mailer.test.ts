import { afterEach, describe, expect, it, vi } from "vitest";
import { BrevoMailer, ConsoleMailer, mailerFromEnv } from "@/server/mailer";

const previousKey = process.env.BREVO_API_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = previousKey;
});

describe("mailer", () => {
  it("uses the console transport unless BREVO_API_KEY is set", async () => {
    delete process.env.BREVO_API_KEY;
    const logs: string[] = [];
    const spy = vi.spyOn(console, "info").mockImplementation((message?: unknown) => {
      logs.push(String(message));
    });
    const mailer = mailerFromEnv();
    expect(mailer).toBeInstanceOf(ConsoleMailer);
    await mailer.send({ to: "ada@example.com", subject: "Verify your email", text: "token=abc" });
    expect(logs.some((line) => line.includes("ada@example.com"))).toBe(true);
    expect(logs.some((line) => line.includes("token=abc"))).toBe(true);
    spy.mockRestore();
  });

  it("posts to Brevo and does not log the API key", async () => {
    const key = "test-brevo-key";
    process.env.BREVO_API_KEY = key;
    process.env.BREVO_SENDER_EMAIL = "no-reply@example.com";
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("{}", { status: 201 });
    }) as typeof fetch;
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const mailer = mailerFromEnv(fetchImpl);
    expect(mailer).toBeInstanceOf(BrevoMailer);
    await mailer.send({ to: "ada@example.com", subject: "Reset your password", text: "hello" });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.brevo.com/v3/smtp/email");
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("api-key")).toBe(key);
    const body = JSON.parse(String(calls[0]?.init.body)) as { textContent: string; to: { email: string }[] };
    expect(body.textContent).toBe("hello");
    expect(body.to[0]?.email).toBe("ada@example.com");
    expect(JSON.stringify(info.mock.calls)).not.toContain(key);
    expect(JSON.stringify(error.mock.calls)).not.toContain(key);
    info.mockRestore();
    error.mockRestore();
  });
});
