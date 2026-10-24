import { test, expect } from '@playwright/test';

test.describe('Modal & Interactive Forms Suite', () => {
  test('Cloudflare Connect Modal & Job Modal Interactivity', async ({ page }) => {
    // Ensure authenticated session
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    if (currentUrl.includes('/setup')) {
      await page.fill('input[placeholder="admin"]', 'admin');
      await page.locator('input[type="password"]').first().fill('MasterPass123!');
      await page.locator('input[type="password"]').nth(1).fill('MasterPass123!');
      await page.click('button:has-text("Initialize PulseDNS Dashboard")');
      await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    } else if (currentUrl.includes('/login')) {
      await page.fill('input[placeholder="admin"]', 'admin');
      await page.fill('input[type="password"]', 'MasterPass123!');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    }

    // 1. Test Cloudflare Connect Modal
    await page.goto('http://localhost:3000/integrations');
    await page.click('button:has-text("Connect Account")');

    // Verify modal is visible
    await expect(page.getByRole('heading', { name: 'Connect Cloudflare Account' })).toBeVisible();
    await expect(page.locator('text=Zero plaintext token exposure')).toBeVisible();

    // Type invalid token and submit
    await page.fill('input[placeholder*="Paste scoped Cloudflare"]', 'invalid_token_test');
    await page.click('button:has-text("Verify & Connect")');

    // Should display real Cloudflare error toast or message
    await expect(page.locator('text=6003').or(page.locator('text=Invalid request headers')).or(page.locator('text=1000')).or(page.locator('text=Invalid API Token'))).toBeVisible({ timeout: 10000 });

    // Close modal
    await page.click('button:has-text("Cancel")');
    await expect(page.getByRole('heading', { name: 'Connect Cloudflare Account' })).not.toBeVisible();

    // 2. Test Create DDNS Job Modal
    await page.goto('http://localhost:3000/jobs');
    await page.click('button:has-text("Create First Job")');

    await expect(page.getByRole('heading', { name: 'Create Automated DDNS Job' })).toBeVisible();
    await page.fill('input[placeholder*="Home Server"]', 'Interactive Test Job');

    // Switch between Server IP and Remote Agent mode
    await page.click('button:has-text("Remote Agent / Client")');
    await page.click('button:has-text("Server Public IP")');

    // Close modal with Cancel button
    await page.click('button:has-text("Cancel")');
    await expect(page.getByRole('heading', { name: 'Create Automated DDNS Job' })).not.toBeVisible();
  });
});
