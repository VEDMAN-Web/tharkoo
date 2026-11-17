import { cookies } from "next/headers";
import { UserPanelHome } from "./UserPanelHome";
import { SESSION_COOKIE } from "@/server/auth/http";
import { userFromToken } from "@/server/auth/service";
import { readOwnPresence } from "@/server/availability/service";
import { profileProgress } from "@/lib/ui/profile-progress";
import { readMoneySettings } from "@/server/billing/money-settings";
import { listOwnCards } from "@/server/listings/owner-cards";
import { loadPacks, loadPanelSummary, type PackRow } from "@/server/notifications/summary";

function homePacks(packs: PackRow[]): PackRow[] {
  const popular = packs.find((pack) => /popular/i.test(pack.tag ?? ""));
  if (!popular) return packs.slice(0, 4);
  const others = packs.filter((pack) => pack !== popular).slice(0, 3);
  return [others[0], popular, others[1], others[2]].filter((pack): pack is PackRow => Boolean(pack));
}

/** H7.6, H7.17: loads everything the user panel home needs, on the server. Used by /u/account/ and /u/account/dashboard/. */
export async function PanelHomePage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [summary, packs] = await Promise.all([loadPanelSummary(token), loadPacks()]);
  const ads = summary.signedIn && summary.adCount > 0 ? await listOwnCards(summary.userId, { page: 1, pageSize: 6 }) : null;
  const session = summary.signedIn && summary.seller ? await userFromToken(token) : null;
  const presence = session ? await readOwnPresence(session.user.id) : null;
  const profile = session
    ? profileProgress({
        hasProfile: Boolean(session.user.seller),
        emailVerified: Boolean(session.user.emailVerifiedAt),
        whatsapp: Boolean(session.user.seller?.whatsapp),
        idChecked: session.user.verificationStatus === "approved",
        hasAd: Boolean(ads && ads.counts.live + ads.counts.review + ads.counts.ended > 0),
        liveChat: Boolean(presence?.liveChat),
      })
    : null;
  // An advertiser sees what the credits are worth in ads (only while posting costs credits) and Withdraw only with earnings.
  const seller = summary.signedIn && summary.seller;
  const money = seller ? await readMoneySettings() : null;
  const adsLeft = summary.signedIn && money && money.paidPostingOn && money.postingFeeCredits > 0 ? Math.floor(summary.balance / money.postingFeeCredits) : null;
  return <UserPanelHome summary={summary} ads={ads} packs={homePacks(packs)} profile={profile} adsLeft={adsLeft} />;
}
