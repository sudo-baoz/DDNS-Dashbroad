import { test, expect } from '@playwright/test';

test.describe('PulseDNS End-to-End Suite', () => {
  test('Complete DDNS Lifecycle: Setup/Login -> Dashboard -> Navigation -> Agent -> Audit Logs', async ({ page }) => {
    // 1. Visit root. If not setup, complete setup. If already setup, log in.
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/setup')) {
      await expect(page.getByRole('heading', { name: 'Welcome to PulseDNS' })).toBeVisible();
      await page.fill('input[placeholder="admin"]', 'admin');
      await page.locator('input[type="password"]').first().fill('MasterPass123!');
      await page.locator('input[type="password"]').nth(1).fill('MasterPass123!');
      await page.click('button:has-text("Initialize PulseDNS Dashboard")');
      await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    } else if (currentUrl.includes('/login')) {
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
      await page.fill('input[placeholder="admin"]', 'admin');
      await page.fill('input[type="password"]', 'MasterPass123!');
      await page.click('button:has-text("Sign In")');
      await page.waitForURL('http://localhost:3000/', { timeout: 10000 });
    }

    // 2. Overview Dashboard Verification
    await expect(page.getByRole('heading', { name: 'Operational Overview' })).toBeVisible();
    await expect(page.locator('text=Managed Domains')).toBeVisible();
    await expect(page.locator('text=Active DDNS Records')).toBeVisible();
    await expect(page.locator('text=Public IP Telemetry')).toBeVisible();

    // 3. Theme Toggle Test
    const themeBtn = page.locator('button[title*="Mode"]').first();
    await themeBtn.click();
    await page.waitForTimeout(300);
    await themeBtn.click();

    // 4. Navigate to Integrations Page
    await page.goto('http://localhost:3000/integrations');
    await expect(page.getByRole('heading', { name: 'DNS Provider Integrations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cloudflare DNS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DuckDNS' })).toBeVisible();
    await expect(page.locator('text=COMING SOON').first()).toBeVisible();

    // 5. Navigate to Domains Page
    await page.goto('http://localhost:3000/domains');
    await expect(page.getByRole('heading', { name: 'Domains & Zones' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync from Cloudflare' })).toBeVisible();

    // 6. Navigate to DNS Records Page
    await page.goto('http://localhost:3000/records');
    await expect(page.getByRole('heading', { name: 'DNS Records' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Managed Record' })).toBeVisible();

    // 7. Navigate to DDNS Jobs Page
    await page.goto('http://localhost:3000/jobs');
    await expect(page.getByRole('heading', { name: 'DDNS Jobs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create DDNS Job' })).toBeVisible();

    // 8. Navigate to Settings Page & Remote Agents
    await page.goto('http://localhost:3000/settings');
    await expect(page.getByRole('heading', { name: 'Settings & Diagnostics' })).toBeVisible();

    // Switch to DDNS Engine tab
    await page.click('button:has-text("DDNS Engine")');
    await expect(page.locator('text=Default Check Interval')).toBeVisible();

    // Switch to Remote Agents tab
    await page.click('button:has-text("Remote Agents")');
    await expect(page.locator('text=Remote Agent Tokens')).toBeVisible();

    // Generate a new remote agent token
    await page.click('button:has-text("Generate Token")');
    await page.fill('input[placeholder*="Home Proxmox"]', 'Home Lab Server E2E');
    await page.click('button[type="submit"]:has-text("Generate Token")');

    // Token modal should display generated bearer token
    await expect(page.getByRole('heading', { name: 'Agent Token Created' })).toBeVisible();
    const tokenInput = page.locator('input[readonly]');
    await expect(tokenInput).toBeVisible();
    const rawToken = await tokenInput.inputValue();
    expect(rawToken).toContain('pulse_');

    await page.click('button:has-text("Done")');

    // Switch to System Health tab
    await page.click('button:has-text("System Health")');
    await expect(page.locator('text=Runtime Engine Diagnostics')).toBeVisible();
    await expect(page.locator('text=Data Persistence & Statistics')).toBeVisible();

    // 9. Navigate to Activity & Logs Page
    await page.goto('http://localhost:3000/activity');
    await expect(page.getByRole('heading', { name: 'Activity & Audit Logs' })).toBeVisible();
    await expect(page.locator('text=AUTH_').first()).toBeVisible();

    // 10. Test Remote Agent Reporting API via curl/fetch
    const agentRes = await page.request.post('http://localhost:3000/api/agent/update', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      data: { ip: '198.51.100.88' },
    });
    expect(agentRes.ok()).toBeTruthy();
    const agentJson = await agentRes.json();
    expect(agentJson.success).toBe(true);
    expect(agentJson.reportedIp).toBe('198.51.100.88');

    // Revisit Activity and verify IP_CHANGE was recorded
    await page.reload();
    await expect(page.locator('text=IP_CHANGE').first()).toBeVisible();
  });
});
