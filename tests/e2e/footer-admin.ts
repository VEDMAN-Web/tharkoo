import type { Page } from "@playwright/test";
import { withLocalDb } from "./helpers";

/**
 * H17.14a: the footer draws WhatsApp and Telegram only when the admin screen (Menus and footer) has a number or a handle.
 * This puts such values in the local test database for one test and takes them out again, whatever the test does.
 */

const CONTACTS = [
  { kind: "whatsapp", label: "WhatsApp", value: "+91 90000 11111", href: "", visible: true },
  { kind: "telegram", label: "Telegram", value: "@tharkoo_test", href: "", visible: true },
  { kind: "phone", label: "Phone", value: "+91 90000 33333", href: "", visible: true },
];
const CHAT = { "config.chat.whatsapp": "https://wa.me/919000011111", "config.chat.telegram": "https://t.me/tharkoo_test" };
const SOCIALS = [
  { label: "WhatsApp", href: "https://wa.me/919000011111", visible: true, icon: "tag" },
  { label: "Telegram", href: "https://t.me/tharkoo_test", visible: true, icon: "tag" },
];

const waiting = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withFooterAdmin(page: Page, path: string, run: () => Promise<void>): Promise<void> {
  const saved = await withLocalDb((db) => db.collection("shell_config_settings").findOne({ key: "default" }, { projection: { "config.footer.contacts": 1, "config.footer.socials": 1, "config.chat.whatsapp": 1, "config.chat.telegram": 1 } }));
  await withLocalDb((db) => db.collection("shell_config_settings").updateOne({ key: "default" }, { $set: { "config.footer.contacts": CONTACTS, "config.footer.socials": SOCIALS, ...CHAT } }, { upsert: true }));
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await page.goto(path);
      if ((await page.locator('[data-tk="footer"]').getByRole("link", { name: "Tharkoo on WhatsApp" }).count()) > 0) break;
      await waiting(2000);
    }
    await run();
  } finally {
    const config = (saved as { config?: { footer?: { contacts?: unknown; socials?: unknown }; chat?: { whatsapp?: string; telegram?: string } } } | null)?.config;
    const footer = config?.footer;
    const chat = { "config.chat.whatsapp": config?.chat?.whatsapp ?? "", "config.chat.telegram": config?.chat?.telegram ?? "" };
    await withLocalDb((db) =>
      db.collection("shell_config_settings").updateOne(
        { key: "default" },
        footer?.contacts !== undefined || footer?.socials !== undefined
          ? { $set: { "config.footer.contacts": footer?.contacts ?? [], "config.footer.socials": footer?.socials ?? [], ...chat } }
          : { $unset: { "config.footer.contacts": "", "config.footer.socials": "", "config.chat.whatsapp": "", "config.chat.telegram": "" } },
      ),
    );
  }
}
