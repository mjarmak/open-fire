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

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(1200);

    const searchInput = dialog.getByRole('textbox', { name: 'Search symbols' });
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
    await expect(row.locator('.position-title-inline-metric')).toContainText('0.77%');
    await expect(row.locator('.position-title-inline-metric')).toContainText('$18.20');
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
    await expect(row.getByRole('button', { name: 'Add' })).toBeVisible();

    const rowBox = await row.boundingBox();
    const addBox = await row.getByRole('button', { name: 'Add' }).boundingBox();
    expect(rowBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    expect(addBox!.y).toBeLessThanOrEqual(rowBox!.y + 10);

    await row.getByRole('button', { name: 'Add' }).click();
    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await expect(addDialog).toBeVisible();
    await expect(addDialog.locator('input[name="symbol"]')).toHaveValue('AAPL');

    expect(api.calls['GET /symbols/search']).toBe(1);
    expect(api.calls['GET /stocks/preview'] || 0).toBe(0);
  });

  test('stock search selects input on open but does not refocus after results render', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    const searchInput = dialog.getByRole('textbox', { name: 'Search symbols' });
    await expect(searchInput).toBeFocused();

    const selection = await searchInput.evaluate((input) => ({
      start: (input as HTMLInputElement).selectionStart,
      end: (input as HTMLInputElement).selectionEnd,
      length: (input as HTMLInputElement).value.length,
    }));
    expect(selection.start).toBe(0);
    expect(selection.end).toBe(selection.length);

    const searchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return url.pathname.endsWith('/api/symbols/search')
        && url.searchParams.get('includeIndicators') === 'true';
    });
    await searchInput.fill('app');
    const closeButton = dialog.locator('button[title="Close dialog"]');
    await closeButton.focus();
    await searchRequest;

    await expect(dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' })).toBeVisible();
    await expect(closeButton).toBeFocused();
  });

  test('stock search clears stale results immediately when editing an existing query', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    const searchInput = dialog.getByRole('textbox', { name: 'Search symbols' });
    const resultRows = dialog.locator('.stock-lookup-result-row');

    await searchInput.fill('app');
    await expect(resultRows.filter({ hasText: 'AAPL' })).toBeVisible();

    await searchInput.press('l');

    expect(await resultRows.count()).toBe(0);
    await expect(dialog.locator('.stock-lookup-empty')).toContainText('Searching...');
  });

  test('logout returns user to welcome screen', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
  });
});
