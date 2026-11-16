import type { ReactNode } from "react";
import { makeT } from "@/lib/ui/text";
import type { BlockBase } from "@/server/models/layout";
import { HomeSearchForm } from "../HomeSearchForm";
import { HomeAds } from "./Ads";
import { HomeBanner } from "./Banner";
import { HomeCategories, pickCategories } from "./Categories";
import { HomeLatestPosts } from "./LatestPosts";
import { HomeSteps } from "./Steps";
import { HomeTrust } from "./Trust";
import { cardLabelsOf, searchLabelsOf } from "./labels";
import type { Hero, HomeData } from "./types";
import "../home-spec.css";

type Props = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : "");
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function heroOf(props: Props): Hero {
  const desktop = props.imageDesktop as { src?: string; alt?: string; width?: number; height?: number } | undefined;
  const mobile = props.imageMobile as { src?: string } | undefined;
  const focus = props.focus as { x?: number; y?: number } | undefined;
  const phone = props.phoneFocus as { x?: number; y?: number } | undefined;
  return {
    photo: desktop?.src ?? "",
    photoAlt: desktop?.alt ?? "",
    desktop: text(props.h1),
    searchPlaceholder: "",
    ...(mobile?.src ? { photoPhone: mobile.src } : {}),
    ...(focus ? { focusX: focus.x, focusY: focus.y } : {}),
    ...(phone ? { phoneFocusX: phone.x, phoneFocusY: phone.y } : {}),
    ...(props.textInImage === true ? { textInImage: true } : {}),
    ...(desktop?.width && desktop?.height ? { photoWidth: desktop.width, photoHeight: desktop.height } : {}),
  };
}

/** The New design home page from a format 2 layout: the same components as NewHome, in the order and with the text of the blocks. */
export function HomeBlocksV2({ blocks, data }: { blocks: BlockBase[]; data: HomeData }) {
  const t = makeT(data.texts);
  const live = blocks.filter((block) => block.visible);
  const out: ReactNode[] = [];
  for (let index = 0; index < live.length; index += 1) {
    const block = live[index];
    const props = block.props as Props;
    if (block.type === "homeBanner") {
      const next = live[index + 1];
      const trust = next && next.type === "homeTrust" ? next : null;
      if (trust) index += 1;
      out.push(
        <section key={block.id} className="tkh-page" aria-label="Banner">
          <HomeBanner hero={heroOf(props)} sub={text(props.subline)} />
          {props.showSearch === false ? null : (
            <HomeSearchForm
              paths={data.paths}
              labels={searchLabelsOf(t)}
              countries={data.countries}
              categories={data.categories.filter((cat) => cat.slug && cat.name).map((cat) => ({ slug: cat.slug || "", name: cat.name || "" }))}
            />
          )}
          {trust ? <HomeTrust pills={list<{ label: string }>((trust.props as Props).items)} /> : null}
        </section>,
      );
    } else if (block.type === "homeTrust") {
      out.push(
        <section key={block.id} className="tkh-page">
          <HomeTrust pills={list<{ label: string }>(props.items)} />
        </section>,
      );
    } else if (block.type === "homeCategories") {
      const picked = props.source === "picked" ? list<string>(props.picked) : undefined;
      out.push(
        <HomeCategories
          key={block.id}
          eyebrow={text(props.eyebrow)}
          title={text(props.title)}
          allText={text(props.allText)}
          cats={pickCategories(data.categories, typeof props.count === "number" ? props.count : 4, picked)}
          shell={data.shell}
          paths={data.paths}
        />,
      );
    } else if (block.type === "homeAds") {
      out.push(
        <HomeAds
          key={block.id}
          eyebrow={text(props.eyebrow)}
          titleTemplate={text(props.title)}
          defaultPlace={t("home.ads.defaultPlace")}
          listLabel={text(props.listLabel)}
          moreText={text(props.moreText)}
          fallbackTitle={t("card.fallbackTitle")}
          labels={cardLabelsOf(t)}
          ads={data.ads}
          categories={data.categories}
          countries={data.countries}
          paths={data.paths}
        />,
      );
    } else if (block.type === "homeSteps") {
      out.push(<HomeSteps key={block.id} eyebrow={text(props.eyebrow)} title={text(props.title)} steps={list<{ title: string; text: string }>(props.items)} />);
    } else if (block.type === "latestPosts") {
      const count = typeof props.count === "number" ? props.count : 3;
      out.push(<HomeLatestPosts key={block.id} title={text(props.title)} posts={(data.posts ?? []).slice(0, count)} />);
    }
  }
  return <div className="tkh-home">{out}</div>;
}
