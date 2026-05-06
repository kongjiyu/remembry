import { chromium } from "@playwright/test";

const BASE_URL = "http://localhost:3000";
const OUTPUT_DIR = "./public";

async function takeScreenshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  const pages = [
    { name: "01-home", path: "/meetings", waitFor: ".flex.items-center.gap-4" },
    { name: "02-meetings", path: "/meetings", waitFor: ".flex.items-center.gap-4" },
    { name: "03-new-meeting", path: "/meetings/new", waitFor: "button" },
    { name: "04-settings", path: "/settings", waitFor: "button" },
  ];

  console.log("Taking screenshots with proper wait...");

  for (const p of pages) {
    try {
      console.log(`\nNavigating to ${p.path}...`);
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: "networkidle", timeout: 30000 });

      // Wait for specific content to load
      if (p.waitFor) {
        try {
          await page.waitForSelector(p.waitFor, { timeout: 10000 });
          console.log(`  Found content: ${p.waitFor}`);
        } catch (e) {
          console.log(`  Warning: Could not find ${p.waitFor}, proceeding anyway`);
        }
      }

      // Additional wait for any async data
      await page.waitForTimeout(2000);

      const url = page.url();
      console.log(`  URL: ${url}`);

      // Take screenshot
      await page.screenshot({ path: `${OUTPUT_DIR}/${p.name}.png`, fullPage: false });

      console.log(`✓ ${p.name}`);
    } catch (error) {
      console.error(`✗ ${p.name}: ${error.message}`);
    }
  }

  await browser.close();
  console.log("\nDone!");
}

takeScreenshots();
