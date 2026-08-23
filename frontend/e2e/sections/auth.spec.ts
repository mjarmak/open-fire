import { expect, test } from '@playwright/test';
import { registerMockApi } from '../fixtures/mock-api';

test.describe('Jenius Auth Section', () => {
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
