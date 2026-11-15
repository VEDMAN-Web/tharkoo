import { makeT, type UiTextMap } from "@/lib/ui/text";
import "./home-spec.css";

/**
 * P1: the strip above the header on the home page ("Sellers online now", "Free to post", "Fresh ads, live for 72 hours").
 * It scrolls away with the page; the header below it stays sticky, as in the mockup. One row; on a phone it scrolls
 * sideways inside itself (the page never does).
 */
export function UtilityStrip({ texts }: { texts?: UiTextMap }) {
  const t = makeT(texts);
  return (
    <div className="tkh-utility">
      <ul className="tkh-utility-in" tabIndex={0} aria-label="Site highlights">
        <li className="tkh-util tkh-util-mint">
          <i aria-hidden="true" />
          {t("home.utility.online")}
        </li>
        <li className="tkh-util tkh-util-lavender">{t("home.utility.free")}</li>
        <li className="tkh-util tkh-util-peach">{t("home.utility.hours")}</li>
      </ul>
    </div>
  );
}
