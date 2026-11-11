import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(`<!doctype html>
<html>
  <body style="margin:0;background:#FFFDFB;color:#6A2150;height:630px;display:flex;align-items:center;padding:80px;box-sizing:border-box">
    <div>
      <div style="font-family:Georgia,serif;font-size:88px;line-height:1;font-weight:700">tharkoo</div>
      <div style="margin-top:18px;font-family:sans-serif;font-size:32px;color:#A63A5E">Classifieds for people in India</div>
    </div>
  </body>
</html>`);
const png = await page.screenshot({ type: "png" });
writeFileSync(new URL("../public/brand/og-default.png", import.meta.url), png);
await browser.close();
console.log("wrote public/brand/og-default.png");
