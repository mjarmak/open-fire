import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Header Section', () => {
  test('toggles theme mode', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const root = page.locator('app-root');
    await expect(root).toHaveClass(/dark-theme/);
    await page.getByRole('button', { name: 'Light mode' }).click();
    await expect(root).toHaveClass(/light-theme/);
  });

  test('refresh button reloads dashboard requests', async ({ page }) => {
    const api = await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const initialIndicatorCalls = api.calls['GET /indicators'] || 0;
    await page.getByRole('button', { name: 'Refresh Dashboard' }).click();
    await expect.poll(() => api.calls['GET /indicators'] || 0).toBeGreaterThan(initialIndicatorCalls);
  });

  test('alerts button opens the alerts dialog', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await expect(page.getByRole('heading', { name: 'Active Alerts' })).toBeVisible();
  });

  test('stock search opens a capped dialog and renders enriched portfolio-style rows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const api = await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search stock risks' }).click();
    const dialog = page.getByRole('dialog', { name: 'Find Stock Risks' });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(1200);

    const searchInput = dialog.getByRole('textbox', { name: 'Search stocks' });
    const searchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/symbols/search')
        && url.searchParams.get('includeIndicators') === 'true';
    });
    await searchInput.fill('app');
    await expect(searchInput).toHaveValue('app');
    await searchRequest;

    const row = dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' });
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/stock-row/);
    await expect(row.locator('.ticker-identity')).toContainText('Apple Inc.');
    await expect(row.locator('.ticker-identity')).toContainText('US - USD');
    await expect(row.locator('.ticker-metrics')).toContainText('Price');
    await expect(row.locator('.ticker-metrics')).toContainText('$198');
    await expect(row.locator('.ticker-metrics')).toContainText('Fear');
    await expect(row.locator('.ticker-metrics')).toContainText('63/100');
    await expect(row.locator('.ticker-metrics')).toContainText('P/E');
    await expect(row.locator('.ticker-metrics')).toContainText('29.1');
    await expect(row.locator('.ticker-metrics')).toContainText('Market Cap');
    await expect(row.locator('.ticker-metrics')).toContainText('$2.9T');
    await expect(row.locator('.ticker-metrics')).toContainText('30D');
    await expect(row).toContainText('No active alert.');

    expect(api.calls['GET /symbols/search']).toBe(1);
    expect(api.calls['GET /stocks/preview'] || 0).toBe(0);
  });

  test('logout returns user to welcome screen', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
  });
});
