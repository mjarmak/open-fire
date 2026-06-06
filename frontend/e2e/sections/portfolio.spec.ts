import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Portfolio Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('adds, edits, collapses, and deletes a position', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await expect(addDialog).toBeVisible();
    const addPositionCostRow = addDialog.locator('.position-cost-row');
    await expect(addPositionCostRow).toBeVisible();
    await expect(addPositionCostRow.locator('.position-cost-times')).toHaveText('×');
    const addQuantityBox = await addPositionCostRow.locator('input[name="quantity"]').boundingBox();
    const addTimesBox = await addPositionCostRow.locator('.position-cost-times').boundingBox();
    const addAvgCostBox = await addPositionCostRow.locator('input[name="averageCost"]').boundingBox();
    expect(addQuantityBox).not.toBeNull();
    expect(addTimesBox).not.toBeNull();
    expect(addAvgCostBox).not.toBeNull();
    expect(addQuantityBox!.x).toBeLessThan(addTimesBox!.x);
    expect(addTimesBox!.x).toBeLessThan(addAvgCostBox!.x);
    const symbolInput = addDialog.locator('input[name="symbol"]');
    await symbolInput.fill('NVDA');
    await expect(addDialog.locator('.symbol-option').first()).toBeVisible({ timeout: 4_000 });
    await addDialog.locator('.symbol-option').first().click();
    await addDialog.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
    await addDialog.getByRole('spinbutton', { name: 'Avg Cost' }).fill('900');
    await addDialog.getByRole('button', { name: 'Add' }).click();
    await expect(addDialog).toBeHidden();
    await expect(page.locator('.stock-row').filter({ hasText: 'NVDA' })).toBeVisible();

    const nvdaRow = page.locator('.stock-row').filter({ hasText: 'NVDA' });
    await nvdaRow.click({ position: { x: 12, y: 12 } });
    await expect(nvdaRow).toHaveClass(/collapsed-row/);
    await expect(nvdaRow.locator('.position-expand-hint')).toBeVisible();
    await nvdaRow.locator('.position-expand-hint').click();
    await expect(nvdaRow).not.toHaveClass(/collapsed-row/);
    await expect(nvdaRow.locator('.ticker-metrics')).toBeVisible();

    await nvdaRow.getByRole('button', { name: 'Position actions' }).click();
    const actionDialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(actionDialog).toBeVisible();
    const actionDialogBox = await actionDialog.boundingBox();
    expect(actionDialogBox).not.toBeNull();
    expect(actionDialogBox!.width).toBeLessThanOrEqual(256);
    await actionDialog.getByRole('button', { name: 'Edit' }).click();

    const editDialog = page.getByRole('dialog', { name: 'Edit position' });
    await expect(editDialog).toBeVisible();
    const positionCostRow = editDialog.locator('.position-cost-row');
    await expect(positionCostRow).toBeVisible();
    await expect(positionCostRow.locator('.position-cost-times')).toHaveText('×');
    const quantityBox = await positionCostRow.locator('input[name="editQuantity"]').boundingBox();
    const timesBox = await positionCostRow.locator('.position-cost-times').boundingBox();
    const avgCostBox = await positionCostRow.locator('input[name="editAverageCost"]').boundingBox();
    expect(quantityBox).not.toBeNull();
    expect(timesBox).not.toBeNull();
    expect(avgCostBox).not.toBeNull();
    expect(quantityBox!.x).toBeLessThan(timesBox!.x);
    expect(timesBox!.x).toBeLessThan(avgCostBox!.x);
    await editDialog.getByRole('spinbutton', { name: 'Quantity' }).fill('5');
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).toBeHidden();

    await nvdaRow.getByRole('button', { name: 'Position actions' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('alertdialog', { name: /Remove NVDA/ });
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.stock-row').filter({ hasText: 'NVDA' })).toHaveCount(0);
  });

  test('keeps edit and add dialogs open when clicking outside the dialog panel', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await expect(addDialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(addDialog).toBeVisible();
    await addDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(addDialog).toBeHidden();

    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await aaplRow.getByRole('button', { name: 'Position actions' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Edit' }).click();

    const editDialog = page.getByRole('dialog', { name: 'Edit position' });
    await expect(editDialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(editDialog).toBeHidden();
  });

  test('keeps add position dialog open when dragging from the dialog to the backdrop', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await expect(addDialog).toBeVisible();
    const box = await addDialog.boundingBox();
    expect(box).not.toBeNull();

    await page.mouse.move((box?.x || 0) + (box?.width || 0) / 2, (box?.y || 0) + (box?.height || 0) / 2);
    await page.mouse.down();
    await page.mouse.move(4, 4);
    await page.mouse.up();

    await expect(addDialog).toBeVisible();
    await addDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(addDialog).toBeHidden();
  });

  test('hides collapsed expand hint on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });

    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();

    await aaplRow.click({ position: { x: 12, y: 12 } });

    await expect(aaplRow).toHaveClass(/collapsed-row/);
    await expect(aaplRow.locator('.position-expand-hint')).toBeHidden();
  });

  test('keeps the collapsed expand hint beside the actions menu on desktop', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();

    await aaplRow.click({ position: { x: 12, y: 12 } });
    await expect(aaplRow).toHaveClass(/collapsed-row/);

    const expandHint = aaplRow.locator('.position-expand-hint');
    const menuButton = aaplRow.getByRole('button', { name: 'Position actions' });
    await expect(expandHint).toBeVisible();
    await expect(menuButton).toBeVisible();

    const hintBox = await expandHint.boundingBox();
    const menuBox = await menuButton.boundingBox();
    expect(hintBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(hintBox!.x).toBeLessThan(menuBox!.x);
    expect(Math.abs(hintBox!.y - menuBox!.y)).toBeLessThan(10);
  });

  test('keeps mobile title and profit lines above the expanded metrics grid', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });

    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    const identity = aaplRow.locator('.ticker-identity');
    const metrics = aaplRow.locator('.ticker-metrics');

    await expect(aaplRow).toBeVisible();
    await expect(identity.locator('.position-title-lines')).toContainText('TOTAL');
    await expect(identity.locator('.position-title-inline-metric')).toContainText('0.77%');
    await expect(metrics).toBeVisible();

    const identityBox = await identity.boundingBox();
    const metricsBox = await metrics.boundingBox();
    expect(identityBox).not.toBeNull();
    expect(metricsBox).not.toBeNull();
    expect(metricsBox!.y).toBeGreaterThan(identityBox!.y + identityBox!.height - 1);
  });

  test('does not collapse a position when tooltip targets are clicked', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();
    await expect(aaplRow).not.toHaveClass(/collapsed-row/);

    for (const selector of ['.position-type-dot', '.ticket-type-indicator', '.position-title-inline-metric', '.risk-fear']) {
      await aaplRow.locator(selector).click();
      await expect(aaplRow).not.toHaveClass(/collapsed-row/);
      await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();
    }
  });

  test('shows title metrics, tooltip title, and left-side text without wrapping', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();

    const symbol = aaplRow.locator('.ticket-type-indicator');
    await expect(symbol).toHaveAttribute('data-tooltip', /Apple Inc./);
    await expect(symbol).toHaveAttribute('aria-label', /Apple Inc./);

    const todayMetric = aaplRow.locator('.position-title-inline-metric');
    await expect(todayMetric).toHaveAttribute('data-tooltip', 'Today');
    await expect(todayMetric).toContainText('0.77%');
    await expect(todayMetric).toContainText('$1.52');
    await expect(todayMetric).toContainText('× 12 =');
    await expect(todayMetric).toContainText('$18.20');
    await expect(todayMetric.locator('.position-title-arrow')).toHaveClass(/value-pos/);
    await expect(todayMetric.locator('.position-title-percent')).toHaveClass(/value-pos/);
    await expect(todayMetric.locator('.position-title-value')).toHaveCount(2);
    const todayValueClasses = await todayMetric.locator('.position-title-value').evaluateAll((elements) =>
      elements.map((element) => element.className),
    );
    expect(todayValueClasses.every((className) => className.includes('value-pos'))).toBe(true);

    const titleLines = aaplRow.locator('.position-title-lines');
    await expect(titleLines).toContainText('TOTAL');
    await expect(titleLines).toContainText('12 × $198.2 =');
    await expect(titleLines).toContainText('$2.4K');
    await expect(titleLines).toContainText('16.59%');
    await expect(titleLines).toContainText('Original');
    await expect(titleLines).toContainText('12 × $170 =');
    await expect(titleLines).toContainText('$2K');

    const nowrapValues = await Promise.all([
      todayMetric.evaluate((element) => getComputedStyle(element).whiteSpace),
      titleLines.locator('.position-title-line').first().evaluate((element) => getComputedStyle(element).whiteSpace),
    ]);
    expect(nowrapValues).toEqual(['nowrap', 'nowrap']);
  });

  test('shows watch-only daily change without invested or position-total lines', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await addDialog.locator('input[name="symbol"]').fill('GOOGL');
    await expect(addDialog.locator('.symbol-option').first()).toBeVisible({ timeout: 4_000 });
    await addDialog.locator('.symbol-option').first().click();
    await addDialog.locator('input[name="watchOnly"]').check();
    await addDialog.getByRole('button', { name: 'Add' }).click();
    await expect(addDialog).toBeHidden();

    const watchRow = portfolio.locator('.stock-row').filter({ hasText: 'GOOGL' });
    await expect(watchRow).toBeVisible();
    await expect(watchRow).toHaveClass(/watch-only-row/);

    const todayMetric = watchRow.locator('.position-title-inline-metric');
    await expect(todayMetric).toContainText('0.75%');
    await expect(todayMetric).toContainText('$1.50');
    await expect(todayMetric).not.toContainText('×');
    await expect(watchRow.locator('.position-title-lines')).toHaveCount(0);
  });

  test('keeps portfolio metrics ordered with 30D and Market Cap first and no Price column', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();

    const metricLabels = await aaplRow.locator('.ticker-metrics small').allTextContents();
    expect(metricLabels).toEqual(['30D', 'Market Cap', 'Fear', 'P/E', 'Beta', 'Vol', 'DD']);
    expect(metricLabels).not.toContain('Price');
    expect(metricLabels).not.toContain('Quantity');
    expect(metricLabels).not.toContain('Avg');
  });

  test('leaves alerting portfolio rows without the search-result risk outline', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const msftRow = portfolio.locator('.stock-row').filter({ hasText: 'MSFT' });
    await expect(msftRow).toBeVisible();
    await expect(msftRow).toHaveClass(/alerting/);

    const borderColor = await msftRow.evaluate((element) => getComputedStyle(element).borderColor);
    expect(borderColor).not.toBe('rgb(232, 93, 93)');
    expect(borderColor).not.toBe('rgb(185, 68, 68)');
  });

  test('uses an opacity-only transition when position metrics are toggled', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();

    await aaplRow.click({ position: { x: 12, y: 12 } });
    await expect(aaplRow).toHaveClass(/collapsed-row/);
    await aaplRow.click({ position: { x: 12, y: 12 } });
    await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();

    const transform = await aaplRow.locator('.ticker-metrics').evaluate((element) => getComputedStyle(element).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy();
  });

  test('supports watch-only entry plus export and import CSV', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await addDialog.locator('input[name="symbol"]').fill('TSLA');
    await expect(addDialog.locator('.symbol-option').first()).toBeVisible({ timeout: 4_000 });
    await addDialog.locator('.symbol-option').first().click();
    await addDialog.locator('input[name="watchOnly"]').check();
    await expect(addDialog.getByRole('spinbutton', { name: 'Quantity' })).toBeDisabled();
    await expect(addDialog.getByRole('spinbutton', { name: 'Avg Cost' })).toBeDisabled();
    await expect(addDialog.getByRole('button', { name: 'Add' })).toBeEnabled();
    await addDialog.getByRole('button', { name: 'Cancel' }).click();

    const downloadPromise = page.waitForEvent('download');
    await portfolio.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('portfolio-positions');

    const csvInput = portfolio.locator('input.file-input');
    await csvInput.setInputFiles({
      name: 'positions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('symbol,companyName,quantity,averageCost,watchOnly\nAMZN,Amazon.com Inc.,4,130,false\n', 'utf8'),
    });

    await expect(page.getByText('position(s) imported from CSV', { exact: false })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.stock-row').filter({ hasText: 'AMZN' })).toBeVisible();
  });

  test('shows portfolio loading state and legacy empty message when no holdings exist', async ({ page }) => {
    const api = await registerMockApi(page, {
      stocks: [],
      portfolio: [],
    });

    await page.route('**/api/stocks', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (route.request().method().toUpperCase() === 'GET') {
        await route.fulfill({
          status: 200,
          body: JSON.stringify(api.state.stocks),
          contentType: 'application/json',
        });
      } else {
        await route.continue();
      }
    });

    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const portfolioBoard = page.getByLabel('Portfolio tickers');
    await expect(portfolioBoard.getByText('Loading portfolio...')).toBeVisible();
    await expect(portfolioBoard.getByText('Loading portfolio...')).toBeHidden({ timeout: 5000 });
    await expect(portfolioBoard.getByText('Add a portfolio position above,')).toBeVisible();
  });

  test('shows loading spinners only inside the sections still waiting for data', async ({ page }) => {
    await page.route('**/api/stocks', async (route) => {
      if (route.request().method().toUpperCase() === 'GET') {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      await route.fallback();
    });

    await page.getByRole('button', { name: 'Refresh Dashboard' }).click();

    const indicatorGrid = page.getByLabel('Macro market indicators');
    const portfolioBoard = page.getByLabel('Portfolio tickers');
    const retirementBoard = page.getByLabel('Retirement planner');
    const dcaPanel = page.getByLabel('DCA reminder settings');

    await expect(indicatorGrid.getByText('Loading market indicators and retirement progress...')).toBeHidden();
    await expect(dcaPanel.getByText('Loading DCA reminder settings...')).toBeHidden();
    await expect(portfolioBoard.getByText('Loading portfolio...')).toBeVisible();
    await expect(retirementBoard.getByText('Loading retirement plan...')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();

    await expect(portfolioBoard.getByText('Loading portfolio...')).toBeHidden({ timeout: 5_000 });
    await expect(retirementBoard.getByText('Loading retirement plan...')).toBeHidden({ timeout: 5_000 });
  });
});
