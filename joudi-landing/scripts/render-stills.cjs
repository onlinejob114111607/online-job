// يولّد صور التشكيلات + صورة الهيرو البديلة + صورة المشاركة (OG) + أيقونة آبل
// التشغيل: node scripts/render-stills.cjs   (بيحتاج Playwright + Chromium)
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "public", "images");
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { createServer } = await import("vite");
  const sharp = (await import("sharp")).default;
  const server = await createServer({ root, server: { port: 5199, strictPort: true }, logLevel: "error" });
  await server.listen();
  const base = "http://localhost:5199";
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  const shoot = async (url, w, h, waitReady = true) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.error("pageerror", e.message));
    await page.goto(base + url);
    if (waitReady) await page.waitForFunction("window.__ready === true", null, { timeout: 240000, polling: 500 });
    await page.waitForTimeout(1500);
    const buf = await page.screenshot({ timeout: 240000 });
    await page.close();
    return buf;
  };

  const only = process.argv.slice(2);
  const want = (k) => !only.length || only.includes(k);

  for (const k of ["fashion", "accessories", "beauty", "home"]) {
    if (!want(k)) continue;
    const png = await shoot(`/stills.html?scene=${k}`, 960, 1200);
    await sharp(png).webp({ quality: 82 }).toFile(path.join(out, `${k}.webp`));
    console.log("✓", k);
  }
  if (want("hero")) {
    const png = await shoot(`/stills.html?scene=hero&tier=high`, 1600, 1000);
    await sharp(png).webp({ quality: 84 }).toFile(path.join(out, "hero-still.webp"));
    console.log("✓ hero-still");
  }
  if (want("og")) {
    const png = await shoot(`/scripts/og.html`, 1200, 630, false);
    await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(root, "public", "og.jpg"));
    console.log("✓ og.jpg");
  }
  if (want("icon")) {
    const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
    await page.goto(base + "/public/favicon.svg");
    const png = await page.screenshot();
    await sharp(png).png().toFile(path.join(root, "public", "apple-touch-icon.png"));
    await page.close();
    console.log("✓ apple-touch-icon");
  }
  await browser.close();
  await server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
