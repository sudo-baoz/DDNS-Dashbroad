import { test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const VIEWPORTS = [
  { name: '1920', width: 1920, height: 1080 },
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
  { name: '375', width: 375, height: 667 },
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

test('Capture responsive screenshots across all viewports', async ({ browser }) => {
  const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  if (page.url().includes('/login')) {
    await page.fill('input[placeholder="admin"]', 'admin');
    await page.fill('input[type="password"]', 'MasterPass123!');
    await page.click('button:has-text("Sign In")');
    await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
  }

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const p of PAGES) {
      await page.goto(`http://localhost:3000${p.path}`);
      // Wait for content
      if (p.path === '/') {
        await page.waitForSelector('text=Managed Domains', { timeout: 10000 });
      } else {
        await page.waitForTimeout(600);
      }
      await page.screenshot({
        path: path.join(screenshotsDir, `${p.name}_${vp.name}px.png`),
        fullPage: false,
      });
    }
  }

  // Also capture Login page at 1440 and 390
  const unauthContext = await browser.newContext();
  const unauthPage = await unauthContext.newPage();
  await unauthPage.setViewportSize({ width: 1440, height: 900 });
  await unauthPage.goto('http://localhost:3000/login');
  await unauthPage.screenshot({ path: path.join(screenshotsDir, 'login_1440px.png') });

  await unauthPage.setViewportSize({ width: 390, height: 844 });
  await unauthPage.goto('http://localhost:3000/login');
  await unauthPage.screenshot({ path: path.join(screenshotsDir, 'login_390px.png') });
});
