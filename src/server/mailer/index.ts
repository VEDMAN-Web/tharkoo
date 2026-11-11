const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export interface OutboundMail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: OutboundMail): Promise<void>;
}

/** Used when no mail provider is configured. The body is logged only off production, or on a noindex staging host. */
export class ConsoleMailer implements Mailer {
  async send(mail: OutboundMail) {
    console.info(`[mail] to=${mail.to} subject=${mail.subject}`);
    const staging = process.env.SITE_NOINDEX === "true" || process.env.NODE_ENV !== "production";
    if (staging) console.info(`[mail-body] ${mail.text}`);
  }
}

/** Brevo transactional API. The key is sent as `api-key` and is never logged. */
export class BrevoMailer implements Mailer {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(mail: OutboundMail) {
    const sender = process.env.BREVO_SENDER_EMAIL?.trim() || "no-reply@localhost";
    const replyTo = process.env.BREVO_REPLY_TO?.trim();
    try {
      const response = await this.fetchImpl(BREVO_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": this.apiKey,
        },
        body: JSON.stringify({
          sender: { email: sender, name: process.env.BREVO_SENDER_NAME?.trim() || "Tharkoo" },
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        }),
      });
      if (!response.ok) console.error("mail.failed");
    } catch {
      console.error("mail.failed");
    }
  }
}

export function mailerFromEnv(fetchImpl?: typeof fetch): Mailer {
  const key = process.env.BREVO_API_KEY?.trim();
  if (key) return new BrevoMailer(key, fetchImpl);
  return new ConsoleMailer();
}
