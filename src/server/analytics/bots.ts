const BOT_AGENT = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|whatsapp|curl|wget|python-requests|go-http-client|libwww|okhttp|httpclient|java\//i;

/** H6.17: crawlers and scripts are not counted. A missing or very short user agent counts as a bot. */
export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true;
  return BOT_AGENT.test(userAgent);
}
