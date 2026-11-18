import { ArrowUp, Crown, Megaphone } from "lucide-react";
import { afterFreeTitle, freeAdsTitle, rupeesOf, rupeeText, type PriceListData } from "@/lib/price-list";
import { makeT } from "@/lib/ui/text";
import "./price-card.css";

const t = makeT();
const MAX_DOTS = 10;

const credits = (count: number) => `${count.toLocaleString("en-IN")} ${count === 1 ? "credit" : "credits"}`;
const hoursText = (hours: number) => `${hours} ${hours === 1 ? "hour" : "hours"}`;

function Amount({ rupees, credits: count }: { rupees: number; credits: number }) {
  return (
    <div className="tkc-amt">
      <span className="tkc-rs" data-tk="price-rupees">{rupeeText(rupees)}</span>
      <span className="tkc-cr" data-tk="price-credits">{credits(count)}</span>
    </div>
  );
}

/**
 * H11.1b: "What things cost". Rupees first, credits second. Every number comes from the live settings and plan data (PriceListData),
 * never from here. A row is left out when its plan does not exist or is hidden. Shared by the credits page, the Wallet and the help page.
 */
export function PriceCard({ data, headingTag = "h2" }: { data: PriceListData; headingTag?: "h2" | "h3" }) {
  const Heading = headingTag;
  const unit = data.creditPriceInr;
  const free = data.freeAds;
  const dots = free > 0 && free <= MAX_DOTS && data.freeLeft !== null ? Array.from({ length: free }, (_, index) => index >= free - data.freeLeft!) : [];
  return (
    <section className="tkc" data-tk="price-card" aria-labelledby="price-card-title">
      <Heading id="price-card-title" className="tkc-title">{t("price.title")}</Heading>
      <ul className="tkc-list">
        {!data.paidPostingOn ? (
          <li className="tkc-row" data-tk="price-row-all">
            <span className="tkc-ic" aria-hidden><Megaphone size={26} /></span>
            <div className="tkc-body">
              <p className="tkc-name">{t("price.allFree")}</p>
              <p className="tkc-what">{t("price.allFreeText")}</p>
            </div>
            <span className="tkc-free">{t("price.free")}</span>
          </li>
        ) : (
          <>
            {free > 0 ? (
              <li className="tkc-row" data-tk="price-row-free">
                <span className="tkc-ic" aria-hidden><Megaphone size={26} /></span>
                <div className="tkc-body">
                  <p className="tkc-name">{freeAdsTitle(free)}</p>
                  <p className="tkc-what">{t("price.firstFree", { count: `${free} ${free === 1 ? "ad" : "ads"}` })}</p>
                  {data.freeLeft !== null ? (
                    <p className="tkc-left" data-tk="free-left">
                      {dots.length ? (
                        <span className="tkc-dots" role="img" aria-label={`${data.freeLeft} of ${free} free ads left`}>
                          {dots.map((left, index) => (
                            <span key={index} className={`tkc-dot${left ? "" : " is-used"}`} />
                          ))}
                        </span>
                      ) : null}
                      <span>{`${data.freeLeft} free ${data.freeLeft === 1 ? "ad" : "ads"} left`}</span>
                    </p>
                  ) : null}
                </div>
                <span className="tkc-free" data-tk="price-free">{t("price.free")}</span>
              </li>
            ) : null}
            {data.adFee > 0 ? (
              <li className="tkc-row" data-tk="price-row-ad">
                <span className="tkc-ic" aria-hidden><Megaphone size={26} /></span>
                <div className="tkc-body">
                  <p className="tkc-name">{afterFreeTitle(free)}</p>
                  <p className="tkc-what">{t(free > 0 ? "price.next" : "price.every")}</p>
                </div>
                <Amount rupees={rupeesOf(data.adFee, unit)} credits={data.adFee} />
              </li>
            ) : null}
          </>
        )}
        {data.top ? (
          <li className="tkc-row" data-tk="price-row-top">
            <span className="tkc-ic" aria-hidden><ArrowUp size={26} /></span>
            <div className="tkc-body">
              <p className="tkc-name">{data.top.name}</p>
              <p className="tkc-what">{t("price.top", { hours: hoursText(data.top.hours) })}</p>
            </div>
            <Amount rupees={rupeesOf(data.top.credits, unit)} credits={data.top.credits} />
          </li>
        ) : null}
        {data.superTop ? (
          <li className="tkc-row" data-tk="price-row-super-top">
            <span className="tkc-ic" aria-hidden><Crown size={26} /></span>
            <div className="tkc-body">
              <p className="tkc-name">{data.superTop.name}</p>
              <p className="tkc-what">{t("price.superTop", { hours: hoursText(data.superTop.hours) })}</p>
            </div>
            <Amount rupees={rupeesOf(data.superTop.credits, unit)} credits={data.superTop.credits} />
          </li>
        ) : null}
      </ul>
      <p className="tkc-rate" data-tk="price-rate">{t("recharge.rate", { price: unit })}</p>
    </section>
  );
}
