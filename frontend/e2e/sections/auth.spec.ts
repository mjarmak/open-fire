import { expect, test } from '@playwright/test';
import { registerMockApi } from '../fixtures/mock-api';

test.describe('Jenius Auth Section', () => {
  test('trusts both local and Google Play signed Android builds', async ({ request }) => {
    const response = await request.get('/.well-known/assetlinks.json');

    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/json');
    const statements = await response.json();
    expect(statements).toContainEqual({
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.jenius.openfire',
        sha256_cert_fingerprints: expect.arrayContaining([
          '57:AA:0C:02:74:AB:74:DA:B3:A7:7D:8F:EC:2D:A3:4A:A8:79:C1:A6:97:6F:33:64:40:23:96:D8:BD:5E:3A:8B',
          '2E:70:5E:8E:DE:F4:D7:F4:5B:14:D1:4E:0D:E9:3A:F8:C5:0D:CD:AC:93:64:B1:10:3E:D1:1A:3A:BF:42:73:53',
        ]),
      },
    });
  });

  test('redirects unauthenticated users to Jenius Auth on startup', async ({ page }) => {
    let loginRequested = false;
    await page.route('https://auth.jeniusapps.com/**/auth**', async (route) => {
      loginRequested = true;
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<main>Jenius login</main>' });
    });

    await page.goto('/');

    await expect.poll(() => loginRequested).toBe(true);
    await expect(page.getByRole('button', { name: 'Login' })).toHaveCount(0);
  });

  test('sends the Jenius bearer token to the API without persisting a password', async ({ page }) => {
    await registerMockApi(page);
    const apiAuthorizationHeaders: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiAuthorizationHeaders.push(request.headers()['authorization'] || '');
      }
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    expect(apiAuthorizationHeaders.some((header) => header.startsWith('Bearer '))).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('sma_password'))).toBeNull();
  });
});
