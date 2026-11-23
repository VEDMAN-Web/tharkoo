import { TEXT_DEFAULTS } from "@/lib/ui/text";

/**
 * H19.7: throwaway email domains. The one list lives here. An address on one of these domains, or on any subdomain of one,
 * cannot get a login code and cannot sign up. No package: a plain set, checked by walking up the domain name.
 */
export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  "10minutemail.com", "10minutemail.net", "10minutemail.org", "20minutemail.com", "33mail.com", "anonbox.net", "burnermail.io",
  "dispostable.com", "discard.email", "e4ward.com", "emailfake.com", "emailondeck.com", "fakeinbox.com", "fakemail.net",
  "fakemailgenerator.com", "getairmail.com", "getnada.com", "grr.la", "guerrillamail.biz", "guerrillamail.com",
  "guerrillamail.de", "guerrillamail.info", "guerrillamail.net", "guerrillamail.org", "guerrillamailblock.com",
  "harakirimail.com", "inboxbear.com", "inboxkitten.com", "incognitomail.org", "jetable.org", "linshiyouxiang.net",
  "mail-temp.com", "mailcatch.com", "maildrop.cc", "mailinator.com", "mailinator.net", "mailinator2.com", "mailnesia.com",
  "mailtemp.info", "minuteinbox.com", "mintemail.com", "mohmal.com", "moakt.com", "mytemp.email", "nada.email", "owlymail.com",
  "sharklasers.com", "spam4.me", "spambox.us", "spamgourmet.com", "tempail.com", "tempinbox.com", "tempmail.com",
  "tempmail.dev", "tempmail.net", "tempmailo.com", "temp-mail.io", "temp-mail.org", "temp-mail.ru", "temporary-mail.net",
  "throwawaymail.com", "tmail.ws", "tmpmail.net", "tmpmail.org", "trashmail.com", "trashmail.de", "trashmail.net",
  "yopmail.com", "yopmail.fr", "yopmail.net",
]);

/** The words shown when an address is refused (Site text, Help texts). */
export const OWN_EMAIL_MESSAGE = TEXT_DEFAULTS["help.email.ownAddress"];

/** True when the address is on a throwaway domain or a subdomain of one. Case and surrounding spaces do not matter. */
export function isDisposableEmail(address: string): boolean {
  const email = address.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return false;
  const labels = email.slice(at + 1).split(".");
  for (let start = 0; start < labels.length - 1; start += 1) {
    if (DISPOSABLE_EMAIL_DOMAINS.has(labels.slice(start).join("."))) return true;
  }
  return false;
}
