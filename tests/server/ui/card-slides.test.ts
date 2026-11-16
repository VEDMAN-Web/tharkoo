import { describe, expect, it } from "vitest";
import { cardSlides, CALM_MS, IMAGE_MS, nextSlide, OFFSET_MS, slideDelay } from "@/components/new/card-slides";
import { readContent } from "@/lib/ui/site-content";

describe("card slides (H7.104)", () => {
  it("puts the video first, then the images", () => {
    const slides = cardSlides(["/a.jpg", "/b.jpg"], "/v.mp4", "/p.jpg");
    expect(slides.map((slide) => slide.kind)).toEqual(["video", "image", "image"]);
    expect(slides[0]).toMatchObject({ src: "/v.mp4", poster: "/p.jpg" });
    expect(cardSlides(["/a.jpg"], null).map((slide) => slide.kind)).toEqual(["image"]);
  });

  it("uses the first photo as the poster when the video has none", () => {
    expect(cardSlides(["/a.jpg"], "/v.mp4", null)[0]).toMatchObject({ poster: "/a.jpg" });
  });

  it("loops and skips the video when video is off", () => {
    const slides = cardSlides(["/a.jpg", "/b.jpg"], "/v.mp4");
    expect(nextSlide(0, slides, true)).toBe(1);
    expect(nextSlide(2, slides, true)).toBe(0);
    expect(nextSlide(2, slides, false)).toBe(1);
    expect(nextSlide(0, cardSlides(["/a.jpg", "/b.jpg"]), false)).toBe(1);
  });

  it("holds an image 3 s, offsets the first move by 600 ms per place, and stays calm 6 s after a manual move", () => {
    expect(slideDelay({ kind: "image", first: false, order: 5, now: 1000, calmUntil: 0 })).toBe(IMAGE_MS);
    expect(slideDelay({ kind: "image", first: true, order: 3, now: 1000, calmUntil: 0 })).toBe(IMAGE_MS + 3 * OFFSET_MS);
    expect(slideDelay({ kind: "video", first: true, order: 2, now: 1000, calmUntil: 0 })).toBe(2 * OFFSET_MS);
    expect(slideDelay({ kind: "image", first: false, order: 0, now: 1000, calmUntil: 1000 + CALM_MS })).toBe(CALM_MS);
  });
});

describe("Home categories setting (H7.104)", () => {
  it("defaults to 4 and is kept between 1 and 8", () => {
    expect(readContent(null).homeCategoriesCount).toBe(4);
    expect(readContent({ content: { homeCategoriesCount: 6 } }).homeCategoriesCount).toBe(6);
    expect(readContent({ content: { homeCategoriesCount: 99 } }).homeCategoriesCount).toBe(8);
    expect(readContent({ content: { homeCategoriesCount: 0 } }).homeCategoriesCount).toBe(4);
    expect(readContent({ content: { homeCategoriesCount: "x" } }).homeCategoriesCount).toBe(4);
  });
});
