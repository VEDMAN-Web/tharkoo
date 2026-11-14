import { cookies } from "next/headers";
import { UserPanelHome } from "./UserPanelHome";
import { SESSION_COOKIE } from "@/server/auth/http";
import { loadPacks, loadPanelSummary, loadPickers } from "@/server/notifications/summary";

/** H7.6: loads everything the user panel home needs, on the server. Used by /u/account/ and /u/account/dashboard/. */
export async function PanelHomePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [summary, packs, pickers] = await Promise.all([loadPanelSummary(token), loadPacks(), loadPickers()]);
  return <UserPanelHome summary={summary} packs={packs} categories={pickers.categories} cities={pickers.cities} />;
}
