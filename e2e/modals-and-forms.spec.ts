import { test, expect } from '@playwright/test';

test.describe('Modal & Interactive Forms Suite (Homelab Mode)', () => {
  test('Cloudflare Connect Modal & Job Modal Interactivity', async ({ page }) => {
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
    await page.locator('button:has-text("Create First Job"), button:has-text("Create DDNS Job")').first().click();

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
