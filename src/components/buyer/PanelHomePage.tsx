import { cookies } from "next/headers";
import { UserPanelHome } from "./UserPanelHome";
import { SESSION_COOKIE } from "@/server/auth/http";
import { listOwnCards } from "@/server/listings/owner-cards";
import { loadPanelSummary, loadPickers } from "@/server/notifications/summary";

/** H7.6, H7.17: loads everything the user panel home needs, on the server. Used by /u/account/ and /u/account/dashboard/. */
export async function PanelHomePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [summary, pickers] = await Promise.all([loadPanelSummary(token), loadPickers()]);
  const ads = summary.signedIn && summary.adCount > 0 ? await listOwnCards(summary.userId, { page: 1, pageSize: 6 }) : null;
  return <UserPanelHome summary={summary} ads={ads} categories={pickers.categories} cities={pickers.cities} />;
}
