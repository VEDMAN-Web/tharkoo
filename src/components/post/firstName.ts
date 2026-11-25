/** H21.12c: the first word of the account's name, cut to what "Name on your ads" holds (20). Empty when there is none or it is an email address. */
export function firstName(displayName: string | null | undefined): string {
  const word = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  if (!word || word.includes("@")) return "";
  return word.slice(0, 20);
}
