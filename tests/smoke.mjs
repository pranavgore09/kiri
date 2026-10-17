// Browser smoke test: every wallet on the first step, through pockets, colours and the film to the
// specs page, in a phone-sized window, with no errors on the way.   npm run smoke
// Uses the Chrome already installed (set CHROME_PATH if it isn't in the usual place).
import puppeteer from "puppeteer-core";
import { createServer } from "vite";

const chrome = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const server = await createServer({ server: { port: 5299, strictPort: false }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const failures = [];

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(m.text()));
  const click = (text) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === t);
      if (!b) throw new Error(`no "${t}" button`);
      b.click();
    }, text);

  await page.goto(`${base}#/design`, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  const wallets = await page.$$eval(".choice", (cs) => cs.map((c) => c.getAttribute("aria-label")));
  if (!wallets.length) failures.push("the first step shows no wallets");

  for (const wallet of wallets) {
    errors.length = 0;
    await page.goto(`${base}#/design`, { waitUntil: "networkidle0" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle0" });
    await page.click(`[aria-label="${wallet}"]`);
    await click("Next: colours");
    await click("Next: see it");
    await page.waitForSelector(".viewer canvas", { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500)); // let the film draw a few frames
    await click("See specs");
    await page.waitForSelector(".sheet .wallet-svg");
    const rows = await page.$$eval(".specs > div", (r) => r.length);
    if (rows < 3) failures.push(`${wallet}: specs list only ${rows} rows`);
    if (errors.length) failures.push(`${wallet}: ${errors.join(" | ")}`);
    console.log(`${errors.length ? "✗" : "✓"} ${wallet}`);
  }
} catch (e) {
  failures.push(String(e));
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
