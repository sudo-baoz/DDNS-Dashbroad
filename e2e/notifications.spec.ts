import { test, expect } from '@playwright/test';

test.describe('PulseDNS Discord Webhook Notifications Suite', () => {
  test('Complete Discord Webhook Notification Lifecycle, Preview & History UI', async ({ page }) => {
    // 1. Navigate to Settings -> Notifications tab
    await page.goto('http://localhost:3000/settings?tab=notifications');
    await expect(page).toHaveURL(/tab=notifications/);

    // Verify Tab is Active
    const notifTab = page.getByRole('button', { name: 'Notifications' });
    await expect(notifTab).toBeVisible();

    // Verify Integration Card & Status
    await expect(page.getByRole('heading', { name: 'Discord Webhook Integration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Webhook' })).toBeVisible();

    // Verify Embed Preview Section
    await expect(page.getByRole('heading', { name: 'Discord Embed Live Preview' })).toBeVisible();

    // 2. Interactive Discord Embed Preview Testing
    // Default preview: IP Changed
    await expect(page.locator('text=🌐 Public IP Changed')).toBeVisible();

    // Click "DNS Success" preview tab
    await page.getByRole('button', { name: 'DNS Success' }).click();
    await expect(page.locator('text=✅ DNS Update Succeeded')).toBeVisible();

    // Click "DNS Failed" preview tab
    await page.getByRole('button', { name: 'DNS Failed' }).click();
    await expect(page.locator('text=❌ DNS Update Failed')).toBeVisible();

    // Click "Outage" preview tab
    await page.getByRole('button', { name: 'Outage' }).click();
    await expect(page.locator('text=⚠️ Cloudflare Connection Lost')).toBeVisible();

    // Click "Recovered" preview tab
    await page.getByRole('button', { name: 'Recovered' }).click();
    await expect(page.locator('text=🔄 Cloudflare Connection Recovered')).toBeVisible();

    // Click "Digest" preview tab
    await page.getByRole('button', { name: 'Digest' }).click();
    await expect(page.locator('text=📊 PulseDNS Status Digest')).toBeVisible();

    // 3. Live Bot Name Sync in Embed Preview
    const botNameInput = page.locator('input[placeholder="PulseDNS"]');
    await botNameInput.fill('Homelab Monitor');
    await expect(page.locator('text=Homelab Monitor')).toBeVisible();

    // 4. Invalid Webhook SSRF Validation
    const webhookInput = page.locator('input[placeholder*="discord.com/api/webhooks"]');
    if (await webhookInput.isVisible()) {
      await webhookInput.fill('https://evil-attacker.com/webhook');
      const testBtn = page.getByRole('button', { name: 'Test Webhook' });
      await testBtn.click();
      await expect(page.locator('text=not an authorized Discord endpoint').or(page.locator('text=Webhook test failed'))).toBeVisible({ timeout: 5000 });
    }

    // 5. Valid Webhook Configuration & Persistence
    // If webhook is currently masked, click Replace
    const replaceBtn = page.getByRole('button', { name: 'Replace' });
    if (await replaceBtn.isVisible()) {
      await replaceBtn.click();
    }

    const activeWebhookInput = page.locator('input[placeholder*="discord.com/api/webhooks"]');
    await expect(activeWebhookInput).toBeVisible();

    const sampleValidUrl =
      'https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz0123456789-_ABCDEFGHIJKLMNOPQRST';
    await activeWebhookInput.fill(sampleValidUrl);

    // Toggle Notifications to Enabled if not already
    const enableToggle = page.locator('button[role="switch"]').first();
    const isChecked = (await enableToggle.getAttribute('aria-checked')) === 'true';
    if (!isChecked) {
      await enableToggle.click();
    }

    // Set Bot Name
    await botNameInput.fill('Homelab Monitor');

    // Save Configuration
    const saveBtn = page.getByRole('button', { name: 'Save Configuration' });
    await saveBtn.click();
    await expect(page.locator('text=Discord notification settings saved.')).toBeVisible();

    // Verify Masked Display (Token should never be in plain text)
    await expect(page.locator('input[value*="••••"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Replace' })).toBeVisible();

    // Reload page to verify persistence
    await page.reload();
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.locator('input[value*="••••"]')).toBeVisible();
    await expect(page.locator('input[value*="Homelab Monitor"]')).toBeVisible();

    // 6. Delivery History Table Verification
    await expect(page.getByRole('heading', { name: 'Delivery History' })).toBeVisible();
    await expect(page.getByPlaceholder('Search domain, title, or error...')).toBeVisible();
    await expect(page.getByTitle('Refresh history')).toBeVisible();

    // 7. Mobile Responsive Layout Check
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('heading', { name: 'Discord Webhook Integration' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Configuration' })).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 800 });
  });
});
