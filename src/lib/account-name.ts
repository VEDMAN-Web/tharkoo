/** H7.17: the name shown for an account. A code account is created as "Member", so that counts as no name. */
export function accountName(displayName: string | undefined, email: string): string {
  const name = (displayName || "").trim();
  if (name && name !== "Member") return name;
  return email.split("@")[0] || "there";
}
