import { mkdirSync } from "node:fs";
import { expect, hasHorizontalScroll, test } from "./helpers";

/** H21.10: an ad card photo is shown whole (object-fit contain), with the same photo blurred behind it. */

const SHOTS = ".shots/H21.10";
const PAGES = ["/", "/property/bengaluru/", "/dating/bengaluru/"];

test("card photos are contained with a blurred copy behind, and the card box does not change", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const photos = page.locator(".tkh-ad-slide.tk-bgphoto, .tk-cc-slide.tk-bgphoto");
    await expect(photos.first()).toBeAttached();
    const info = await photos.first().evaluate((node) => {
      const img = node.querySelector("img");
      const before = getComputedStyle(node, "::before");
      return {
        fit: img ? getComputedStyle(img).objectFit : null,
        bg: before.backgroundImage,
        blur: before.filter,
        hidden: node.querySelectorAll("img").length,
        bgVar: (node as HTMLElement).style.getPropertyValue("--tk-bg"),
      };
    });
    expect(info.fit, path).toBe("contain");
    expect(info.bg, path).toContain("url(");
    expect(info.blur, path).toContain("blur(18px)");
    expect(info.bgVar, path).toContain("url(");
    expect(info.hidden, `${path}: one img per slide, the blur is a CSS background`).toBe(1);
    expect(await hasHorizontalScroll(page), path).toBe(false);
  }
  mkdirSync(SHOTS, { recursive: true });
  await page.goto("/");
  await page.locator("[data-tk=home-ad]").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/home-after-${page.viewportSize()?.width}.png` });
});

const PORTRAIT = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#e9d5ff"/><circle cx="200" cy="90" r="70" fill="#f5c9a8"/><rect x="110" y="170" width="180" height="400" rx="60" fill="#7c3aed"/></svg>',
)}`;

test("proof shots: a portrait photo on the home grid, before (old crop) and after", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("[data-tk=home-ad]");
  await expect(cards.first()).toBeAttached();
  await page.evaluate((src) => {
    document.querySelectorAll<HTMLElement>(".tkh-ad-slide.tk-bgphoto").forEach((slide) => {
      slide.style.setProperty("--tk-bg", `url("${src}")`);
      const img = slide.querySelector("img");
      if (img) {
        img.removeAttribute("srcset");
        img.src = src;
      }
    });
  }, PORTRAIT);
  await cards.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  mkdirSync(SHOTS, { recursive: true });
  const width = page.viewportSize()?.width;
  await page.screenshot({ path: `${SHOTS}/home-portrait-after-${width}.png` });
  await page.addStyleTag({ content: ".tk-bgphoto::before{display:none!important}.tk-bgphoto img{object-fit:cover!important;object-position:50% 18%!important}" });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/home-portrait-before-${width}.png` });
});
