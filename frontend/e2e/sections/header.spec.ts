import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Header Section', () => {
  test('toggles theme mode', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const root = page.locator('app-root');
    await expect(root).toHaveClass(/dark-theme/);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Light mode' }).click();
    await expect(root).toHaveClass(/light-theme/);
  });

  test('refresh button reloads dashboard requests', async ({ page }) => {
    const api = await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const initialIndicatorCalls = api.calls['GET /indicators'] || 0;
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Refresh Dashboard' }).click();
    await expect.poll(() => api.calls['GET /indicators'] || 0).toBeGreaterThan(initialIndicatorCalls);
  });

  test('top bar utility actions live in the menu dialog', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const header = page.locator('app-header');
    await expect(header.getByRole('button', { name: 'Refresh Dashboard' })).toHaveCount(0);
    await expect(header.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    await expect(header.getByRole('button', { name: 'Light mode' })).toHaveCount(0);

    await header.getByRole('button', { name: 'Open menu' }).click();

    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Light mode' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Refresh Dashboard' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Logout' })).toBeVisible();

    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.width).toBeLessThanOrEqual(256);

    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();
  });

  test('application logo is centered in a middle top bar panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const topBar = page.locator('app-header .top-bar');
    const leftPanel = topBar.locator('.top-left-panel');
    const middlePanel = topBar.locator('.top-middle-panel');

    await expect(leftPanel.locator('.brand-mark')).toHaveCount(0);
    await expect(middlePanel.locator('.brand-mark')).toBeVisible();
    await expect(middlePanel).toContainText('OpenFIRE');

    const topBarBox = await topBar.boundingBox();
    const middleBox = await middlePanel.boundingBox();
    expect(topBarBox).not.toBeNull();
    expect(middleBox).not.toBeNull();

    const topBarCenter = topBarBox!.x + topBarBox!.width / 2;
    const middleCenter = middleBox!.x + middleBox!.width / 2;
    expect(Math.abs(topBarCenter - middleCenter)).toBeLessThanOrEqual(4);
  });

  test('alerts button opens the alerts dialog', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await expect(page.getByRole('heading', { name: 'Active Alerts' })).toBeVisible();
  });

  test('stock search opens a capped dialog and renders lightweight price rows', async ({ page }) => {
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
        && url.searchParams.get('includeIndicators') !== 'true'
        && url.searchParams.get('includePriceDetails') === 'true';
    });
    await searchInput.fill('app');
    await expect(searchInput).toHaveValue('app');
    await searchRequest;

    const row = dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' });
    await expect(row).toBeVisible();
    await expect(row).toHaveClass(/stock-row/);
    await expect(row.locator('.ticker-identity')).toContainText('Apple Inc.');
    await expect(row.locator('.ticker-identity')).toContainText('US - USD');
    await expect(row.locator('.position-title-inline-metric')).toHaveCount(0);
    await expect(row.locator('.ticker-metrics')).toContainText('Price');
    await expect(row.locator('.ticker-metrics')).toContainText('$198.20');
    await expect(row.locator('.ticker-metrics')).toContainText('Today');
    await expect(row.locator('.ticker-metrics')).toContainText('0.77%');
    await expect(row.locator('.ticker-metrics')).toContainText('$18.20');
    await expect(row.locator('.ticker-metrics')).toContainText('Market Cap');
    await expect(row.locator('.ticker-metrics')).toContainText('$2.9T');
    await expect(row).not.toContainText('Fear');
    await expect(row).not.toContainText('30D');
    await expect(row).not.toContainText('P/E');
    await expect(row).not.toContainText('Vol');
    await expect(row).not.toContainText('DD');
    await expect(row).not.toContainText('No active alert.');
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

  test('stock search result keeps price details inline on tablet widths', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 760 });
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await dialog.getByRole('textbox', { name: 'Search symbols' }).fill('app');

    const row = dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' });
    await expect(row).toBeVisible();

    const identityBox = await row.locator('.ticker-identity').boundingBox();
    const metricsBox = await row.locator('.ticker-metrics').boundingBox();
    const addBox = await row.getByRole('button', { name: 'Add' }).boundingBox();
    expect(identityBox).not.toBeNull();
    expect(metricsBox).not.toBeNull();
    expect(addBox).not.toBeNull();
    expect(Math.abs(metricsBox!.y - identityBox!.y)).toBeLessThanOrEqual(12);
    expect(Math.abs(addBox!.y - identityBox!.y)).toBeLessThanOrEqual(12);
    expect(metricsBox!.x).toBeGreaterThan(identityBox!.x);
    expect(addBox!.x).toBeGreaterThan(metricsBox!.x);
  });

  test('stock search uses price payloads without rendering history-backed indicators', async ({ page }) => {
    const api = await registerMockApi(page);
    let requestedIncludeIndicators: string | null = 'not-called';
    let requestedIncludePriceDetails: string | null = 'not-called';
    await page.route('**/api/symbols/search*', async (route) => {
      const url = new URL(route.request().url());
      requestedIncludeIndicators = url.searchParams.get('includeIndicators');
      requestedIncludePriceDetails = url.searchParams.get('includePriceDetails');
      const aapl = api.state.symbolCatalog.find((item) => item.symbol === 'AAPL');
      await route.fulfill({
        status: 200,
        json: aapl ? [{ ...aapl, indicators: api.state.stocks.find((stock) => stock.symbol === 'AAPL') || null }] : [],
      });
    }, { times: 1 });
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await dialog.getByRole('textbox', { name: 'Search symbols' }).fill('app');

    const row = dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' });
    await expect(row).toBeVisible();
    expect(requestedIncludeIndicators).toBeNull();
    expect(requestedIncludePriceDetails).toBe('true');
    await expect(row.locator('.position-title-inline-metric')).toHaveCount(0);
    await expect(row.locator('.ticker-metrics')).toContainText('Price');
    await expect(row.locator('.ticker-metrics')).toContainText('Market Cap');
    await expect(row).not.toContainText('Fear');
    await expect(row).not.toContainText('30D');
    await expect(row).not.toContainText('P/E');
    await expect(row).not.toContainText('Vol');
    await expect(row).not.toContainText('DD');
    expect(api.calls['GET /stocks/preview'] || 0).toBe(0);
  });

  test('stock search hides empty watched-alert messages', async ({ page }) => {
    const api = await registerMockApi(page);
    api.state.stocks[0].reason = 'No watched stock alerts fired under current thresholds.';
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await dialog.getByRole('textbox', { name: 'Search symbols' }).fill('app');

    const row = dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' });
    await expect(row).toBeVisible();
    await expect(row).not.toContainText('No watched stock alerts fired under current thresholds.');
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
        && url.searchParams.get('includeIndicators') !== 'true'
        && url.searchParams.get('includePriceDetails') === 'true';
    });
    await searchInput.fill('app');
    const closeButton = dialog.locator('button[title="Close dialog"]');
    await closeButton.focus();
    await searchRequest;

    await expect(dialog.locator('.stock-lookup-result-row').filter({ hasText: 'AAPL' })).toBeVisible();
    await expect(closeButton).toBeFocused();
  });

  test('stock search clears stale results immediately when editing an existing query', async ({ page }) => {
    const api = await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Search' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    const searchInput = dialog.getByRole('textbox', { name: 'Search symbols' });
    const resultRows = dialog.locator('.stock-lookup-result-row');

    await searchInput.fill('app');
    await expect(resultRows.filter({ hasText: 'AAPL' })).toBeVisible();

    let releaseSearchResponse!: () => void;
    const heldSearchResponse = new Promise<void>((resolve) => {
      releaseSearchResponse = resolve;
    });
    await page.route('**/api/symbols/search*', async (route) => {
      const url = new URL(route.request().url());
      if ((url.searchParams.get('keywords') || '').trim().toLowerCase() === 'appl') {
        await heldSearchResponse;
      }

      const aapl = api.state.symbolCatalog.find((item) => item.symbol === 'AAPL');
      await route.fulfill({
        status: 200,
        json: aapl ? [{ ...aapl, indicators: api.state.stocks.find((stock) => stock.symbol === 'AAPL') || null }] : [],
      });
    }, { times: 1 });

    await searchInput.press('l');

    await expect(resultRows).toHaveCount(0);
    await expect(dialog.locator('.stock-lookup-empty')).toContainText('Searching...');
    releaseSearchResponse();
  });

  test('logout returns user to welcome screen', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
  });
});
