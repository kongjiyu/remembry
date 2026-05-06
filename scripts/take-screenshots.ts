import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "./public";

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const pages = [
    { name: "01-home", path: "/" },
    { name: "02-meetings", path: "/meetings" },
    { name: "03-new-meeting", path: "/meetings/new" },
    { name: "04-settings", path: "/settings" },
  ];

  console.log("Taking screenshots...");

  for (const p of pages) {
    try {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${OUTPUT_DIR}/${p.name}.png`, fullPage: false });
      console.log(`✓ ${p.name}`);
    } catch (error) {
      console.error(`✗ ${p.name}: ${error.message}`);
    }
  }

  await browser.close();
  console.log("Done!");
}

takeScreenshots();
