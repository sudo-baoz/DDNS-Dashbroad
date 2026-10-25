import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const VIEWPORTS = [
  { name: '1920_desktop', width: 1920, height: 1080 },
  { name: '1440_laptop', width: 1440, height: 900 },
  { name: '768_tablet', width: 768, height: 1024 },
  { name: '390_mobile', width: 390, height: 844 },
  { name: '375_mobile_compact', width: 375, height: 667 },
];

const PAGES = [
  { name: 'dashboard', path: '/' },
  { name: 'domains', path: '/domains' },
  { name: 'records', path: '/records' },
  { name: 'jobs', path: '/jobs' },
  { name: 'integrations', path: '/integrations' },
  { name: 'activity', path: '/activity' },
  { name: 'settings', path: '/settings' },
];

async function main() {
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Iterate over viewports and pages
  for (const vp of VIEWPORTS) {
    console.log(`Capturing viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const p of PAGES) {
      await page.goto(`http://localhost:3000${p.path}`);
      await page.waitForTimeout(600); // allow charts/state to settle
      const filename = path.join(screenshotsDir, `${p.name}_${vp.name}.png`);
      await page.screenshot({ path: filename, fullPage: false });
      console.log(`Saved screenshot: ${filename}`);
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot error:', err);
  process.exit(1);
});
