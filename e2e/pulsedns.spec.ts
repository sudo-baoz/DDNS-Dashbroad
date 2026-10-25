import { test, expect } from '@playwright/test';

test.describe('PulseDNS End-to-End Suite (Homelab No-Auth Mode)', () => {
  test('Instant Dashboard Access, Zero Auth Redirects, Full DDNS Lifecycle & Remote Agent Auth', async ({ page }) => {
    // Track requests to guarantee /api/auth/me is NEVER requested
    const requestedUrls: string[] = [];
    page.on('request', (req) => {
      requestedUrls.push(req.url());
    });

    // 1. Visit root. Dashboard must load immediately with NO login or setup page
    await page.goto('http://localhost:3000/');
    await expect(page).toHaveURL('http://localhost:3000/');

    // Assert /api/auth/me was NEVER called
    const authMeRequests = requestedUrls.filter((url) => url.includes('/api/auth/me'));
    expect(authMeRequests).toHaveLength(0);

    // 2. Backward Compatibility Redirects: Visiting /login or /setup redirects to root
    await page.goto('http://localhost:3000/login');
    await expect(page).toHaveURL('http://localhost:3000/');

    await page.goto('http://localhost:3000/setup');
    await expect(page).toHaveURL('http://localhost:3000/');

    // 3. Operational Overview Dashboard Verification
    await expect(page.getByRole('heading', { name: 'Operational Overview' })).toBeVisible();
    await expect(page.locator('text=Managed Domains')).toBeVisible();
    await expect(page.locator('text=Active DDNS Records')).toBeVisible();
    await expect(page.locator('text=Public IP Telemetry')).toBeVisible();
    await expect(page.locator('text=Homelab Mode')).toBeVisible();

    // 4. Theme Toggle Test
    const themeBtn = page.locator('button[title*="Mode"]').first();
    await themeBtn.click();
    await page.waitForTimeout(200);
    await themeBtn.click();

    // 5. Navigate to Integrations Page
    await page.goto('http://localhost:3000/integrations');
    await expect(page.getByRole('heading', { name: 'DNS Provider Integrations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cloudflare DNS' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'DuckDNS' })).toBeVisible();
    await expect(page.locator('text=COMING SOON').first()).toBeVisible();

    // 6. Navigate to Domains Page
    await page.goto('http://localhost:3000/domains');
    await expect(page.getByRole('heading', { name: 'Domains & Zones' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync from Cloudflare' })).toBeVisible();

    // 7. Navigate to DNS Records Page
    await page.goto('http://localhost:3000/records');
    await expect(page.getByRole('heading', { name: 'DNS Records' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Managed Record' })).toBeVisible();

    // 8. Navigate to DDNS Jobs Page
    await page.goto('http://localhost:3000/jobs');
    await expect(page.getByRole('heading', { name: 'DDNS Jobs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create DDNS Job' }).first()).toBeVisible();

    // 9. Navigate to Settings Page & Remote Agents
    await page.goto('http://localhost:3000/settings');
    await expect(page.getByRole('heading', { name: 'Settings & Diagnostics' })).toBeVisible();

    // Switch to Homelab Security tab
    await page.click('button:has-text("Homelab Security")');
    await expect(page.getByRole('heading', { name: 'Homelab Network Security Model' })).toBeVisible();
    await expect(page.locator('text=Access Boundary')).toBeVisible();
    await expect(page.locator('text=Origin & CSRF Defense')).toBeVisible();
    await expect(page.locator('text=Credential Vault')).toBeVisible();

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

    // 10. Remote Agent Endpoint Authentication Enforcement
    // Unauthenticated or invalid token MUST be rejected with HTTP 401
    const unauthAgentRes = await page.request.post('http://localhost:3000/api/agent/update', {
      headers: {
        Authorization: 'Bearer pulse_invalid_fake_token_12345',
        'Content-Type': 'application/json',
      },
      data: { ip: '198.51.100.99' },
    });
    expect(unauthAgentRes.status()).toBe(401);

    // Valid token MUST succeed with HTTP 200
    const validAgentRes = await page.request.post('http://localhost:3000/api/agent/update', {
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      data: { ip: '198.51.100.88' },
    });
    expect(validAgentRes.ok()).toBeTruthy();
    const agentJson = await validAgentRes.json();
    expect(agentJson.success).toBe(true);
    expect(agentJson.reportedIp).toBe('198.51.100.88');

    // 11. Navigate to Activity & Logs Page
    await page.goto('http://localhost:3000/activity');
    await expect(page.getByRole('heading', { name: 'Activity & Audit Logs' })).toBeVisible();
    await expect(page.locator('text=IP_CHANGE').first()).toBeVisible();
    await expect(page.locator('text=AGENT_TOKEN_CREATE').first()).toBeVisible();
  });
});
