import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

vi.mock("@/components/ContactButtons", () => ({ useContact: () => ({ seller: null }) }));

import { adPhotoAlt } from "@/lib/ad-photo-alt";
import { NewGallery } from "@/components/new/NewGallery";
import { SlideTrack } from "@/components/new/CardSlides";
import type { CardSlide } from "@/components/new/card-slides";

const ref = { current: null } as RefObject<never>;
const noop = () => undefined;

function track(slides: CardSlide[], extra: { eager?: boolean } = {}) {
  return renderToStaticMarkup(
    createElement(SlideTrack, { slides, href: "/dating/surat/x-k7q2z/", trackRef: ref, videoRef: ref, onScroll: noop, onTouch: noop, onClicked: noop, title: "Coffee in Surat", place: "Adajan", eager: extra.eager ?? false }),
  );
}

const photos: CardSlide[] = [
  { kind: "image", src: "/a.jpg" },
  { kind: "image", src: "/b.jpg" },
  { kind: "image", src: "/c.jpg" },
];

describe("H17.6 photo alt text", () => {
  it("is '{ad title}, {area or city}, photo N'", () => {
    expect(adPhotoAlt("Coffee in Surat", "Adajan", 2)).toBe("Coffee in Surat, Adajan, photo 2");
  });

  it("leaves the place out when there is none, and falls back to a plain word for a missing title", () => {
    expect(adPhotoAlt("Coffee in Surat", "", 1)).toBe("Coffee in Surat, photo 1");
    expect(adPhotoAlt("", "Surat", 1)).toBe("Ad, Surat, photo 1");
  });
});

describe("H17.6 card photos", () => {
  it("gives each photo its own alt with its number, and counts photos only, not the video", () => {
    const html = track([{ kind: "video", src: "/v.mp4", poster: "/a.jpg" }, ...photos]);
    const alts = [...html.matchAll(/<img [^>]*alt="([^"]*)"/g)].map((m) => m[1]);
    expect(alts).toEqual(["Coffee in Surat, Adajan, photo 1", "Coffee in Surat, Adajan, photo 2", "Coffee in Surat, Adajan, photo 3"]);
  });

  it("puts width and height on every card photo", () => {
    const html = track(photos);
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    expect(imgs).toHaveLength(3);
    for (const img of imgs) expect(img).toMatch(/width="\d+"[^>]*height="\d+"|height="\d+"[^>]*width="\d+"/);
  });

  it("loads eagerly only the first photo of a first-row card, and everything else lazily", () => {
    const first = (track(photos, { eager: true }).match(/<img [^>]*>/g) ?? []).map((img) => /loading="eager"/.test(img));
    expect(first).toEqual([true, false, false]);
    const later = (track(photos, { eager: false }).match(/<img [^>]*>/g) ?? []).map((img) => /loading="lazy"/.test(img));
    expect(later).toEqual([true, true, true]);
  });
});

describe("H17.6 ad page gallery", () => {
  const gallery = renderToStaticMarkup(createElement(NewGallery, { photos: ["/a.jpg", "/b.jpg"], videos: [], title: "Coffee in Surat", place: "Adajan", isNew: false }));

  it("names the main photo with title, place and number, and keeps the blurred copy decorative", () => {
    expect(gallery).toContain('alt="Coffee in Surat, Adajan, photo 1"');
    expect(gallery).toMatch(/<img [^>]*class="tkn-gal-blur"[^>]*alt=""[^>]*aria-hidden="true"|<img [^>]*alt=""[^>]*aria-hidden="true"[^>]*class="tkn-gal-blur"|<img [^>]*aria-hidden="true"[^>]*/);
  });

  it("puts width and height on the gallery photos", () => {
    const imgs = gallery.match(/<img [^>]*>/g) ?? [];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img).toMatch(/width="\d+"/);
    for (const img of imgs) expect(img).toMatch(/height="\d+"/);
  });
});
