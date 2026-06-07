import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Portfolio Section', () => {
  let api: Awaited<ReturnType<typeof registerMockApi>>;

  test.beforeEach(async ({ page }) => {
    api = await registerMockApi(page);
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
    await expect(nvdaRow).not.toHaveClass(/collapsed-row/);
    await expect(nvdaRow.locator('.ticker-metrics')).toBeVisible();
    await nvdaRow.click({ position: { x: 12, y: 12 } });
    await expect(nvdaRow).toHaveClass(/collapsed-row/);
    await expect(nvdaRow.locator('.ticker-metrics')).toHaveCount(0);
    await expect(nvdaRow.locator('.position-chart-row')).toHaveCount(0);

    await nvdaRow.getByRole('button', { name: 'Position graph' }).click();
    await expect(nvdaRow.locator('.position-chart-row')).toBeVisible();
    await expect(nvdaRow.locator('.chart-range-options button')).toHaveCount(7);
    await expect(nvdaRow.locator('.chart-range-options button.active')).toHaveText('1m');
    await expect(nvdaRow.locator('.ticker-metrics')).toHaveCount(0);

    await nvdaRow.locator('.position-expand-hint').click();
    await expect(nvdaRow).not.toHaveClass(/collapsed-row/);
    await expect(nvdaRow.locator('.ticker-metrics')).toBeVisible();
    await expect(nvdaRow.locator('.position-chart-row')).toBeVisible();

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
    const actionDialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(actionDialog).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(actionDialog).toBeVisible();
    await actionDialog.getByRole('button', { name: 'Edit' }).click();

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
    await page.evaluate(() => localStorage.setItem('sma_collapsed_positions', JSON.stringify(['1'])));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 800 });

    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();

    await expect(aaplRow).toHaveClass(/collapsed-row/);
    await expect(aaplRow.locator('.position-expand-hint')).toBeHidden();
    await expect(aaplRow.locator('.ticker-metrics')).toHaveCount(0);
    await expect(aaplRow.locator('.position-chart-row')).toHaveCount(0);
  });

  test('keeps the collapsed expand hint beside the actions menu on desktop', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('sma_collapsed_positions', JSON.stringify(['1'])));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();
    await expect(aaplRow).toHaveClass(/collapsed-row/);

    const expandHint = aaplRow.locator('.position-expand-hint');
    const graphButton = aaplRow.getByRole('button', { name: 'Position graph' });
    const menuButton = aaplRow.getByRole('button', { name: 'Position actions' });
    await expect(expandHint).toBeVisible();
    await expect(graphButton).toBeVisible();
    await expect(menuButton).toBeVisible();
    await expect(aaplRow.locator('.ticker-metrics')).toHaveCount(0);
    await expect(aaplRow.locator('.position-chart-row')).toHaveCount(0);

    const hintBox = await expandHint.boundingBox();
    const graphBox = await graphButton.boundingBox();
    const menuBox = await menuButton.boundingBox();
    expect(hintBox).not.toBeNull();
    expect(graphBox).not.toBeNull();
    expect(menuBox).not.toBeNull();
    expect(hintBox!.x).toBeLessThan(graphBox!.x);
    expect(graphBox!.x).toBeLessThan(menuBox!.x);
    expect(Math.abs(hintBox!.y - menuBox!.y)).toBeLessThan(10);

    await graphButton.click();
    await expect(aaplRow.locator('.position-chart-row')).toBeVisible();
    await expect(aaplRow.locator('.ticker-metrics')).toHaveCount(0);

    await expandHint.click();
    await expect(aaplRow).not.toHaveClass(/collapsed-row/);
    await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();
    await expect(aaplRow.locator('.position-chart-row')).toBeVisible();
  });

  test('keeps mobile title and profit lines above the expanded metrics grid', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });

    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    const identity = aaplRow.locator('.ticker-identity');
    const metrics = aaplRow.locator('.ticker-metrics');

    await expect(aaplRow).toBeVisible();
    await expect(identity.locator('.position-title-lines')).toContainText('Current');
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

    for (const selector of ['.position-type-dot', '.ticket-type-indicator', '.position-title-inline-metric', '.position-title-lines', '.metric-30d', '.risk-fear']) {
      await aaplRow.locator(selector).click();
      await expect(aaplRow).not.toHaveClass(/collapsed-row/);
      await expect(aaplRow.locator('.ticker-metrics')).toBeVisible();
    }
  });

  test('opens a position graph line with date range options from the graph button', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();
    await expect(aaplRow.locator('.position-chart-row')).toHaveCount(0);

    await aaplRow.click({ position: { x: 12, y: 12 } });
    await expect(aaplRow).toHaveClass(/collapsed-row/);
    await expect(aaplRow.locator('.position-chart-row')).toHaveCount(0);
    expect(api.calls['GET /stocks/AAPL/history'] || 0).toBe(0);

    await aaplRow.click({ position: { x: 12, y: 12 } });
    await expect(aaplRow).not.toHaveClass(/collapsed-row/);
    await aaplRow.getByRole('button', { name: 'Position graph' }).click();
    await expect.poll(() => api.calls['GET /stocks/AAPL/history'] || 0).toBe(1);
    const chartRow = aaplRow.locator('.position-chart-row');
    await expect(chartRow).toBeVisible();
    await expect(chartRow.locator('.chart-range-options button')).toHaveCount(7);
    await expect(chartRow.locator('.chart-range-options button.active')).toHaveText('1m');
    await expect(chartRow.locator('.range-trend-svg .trend-line')).toHaveAttribute('d', /L/);
    await expect(chartRow.locator('.trend-x-axis-label')).toHaveCount(3);
    await expect(chartRow.locator('.trend-y-axis-label')).toHaveCount(5);
    const svgBox = await chartRow.locator('.range-trend-svg').boundingBox();
    const trendLineBox = await chartRow.locator('.range-trend-svg .trend-line').boundingBox();
    const chartContainerBox = await chartRow.locator('.range-trend-container').boundingBox();
    expect(svgBox).not.toBeNull();
    expect(trendLineBox).not.toBeNull();
    expect(chartContainerBox).not.toBeNull();
    expect(svgBox!.height).toBeLessThanOrEqual(110);
    expect(svgBox!.width).toBeGreaterThan(chartContainerBox!.width - 2);
    expect(trendLineBox!.width).toBeGreaterThan(svgBox!.width * 0.75);

    const globalChart = portfolio.locator('.global-risk-chart-panel').filter({ hasText: 'Credit Market' });
    await expect(globalChart).toBeVisible();
    await expect.poll(async () => {
      const currentPositionBox = await chartRow.locator('.range-trend-svg').boundingBox();
      const currentGlobalBox = await globalChart.locator('.range-trend-svg').boundingBox();
      if (!currentPositionBox || !currentGlobalBox) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.max(
        Math.abs(currentGlobalBox.width - currentPositionBox.width),
        Math.abs(currentGlobalBox.height - currentPositionBox.height),
      );
    }).toBeLessThanOrEqual(4);

    await chartRow.locator('.range-trend-container').hover({ position: { x: 320, y: 52 } });
    await expect(chartRow.locator('.range-trend-tooltip')).toBeVisible();
    await expect(chartRow.locator('.range-trend-tooltip')).toContainText('Value');

    await chartRow.locator('.chart-range-options button', { hasText: '1d' }).click();
    await expect(chartRow.locator('.chart-range-options button.active')).toHaveText('1d');
    await expect.poll(() => api.calls['GET /stocks/AAPL/history'] || 0).toBe(2);

    await chartRow.locator('.chart-range-options button', { hasText: '1m' }).click();
    await expect(chartRow.locator('.chart-range-options button.active')).toHaveText('1m');
    await page.waitForTimeout(100);
    expect(api.calls['GET /stocks/AAPL/history'] || 0).toBe(2);

    const rowBox = await aaplRow.boundingBox();
    const chartBox = await chartRow.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(chartBox).not.toBeNull();
    expect(chartBox!.y).toBeGreaterThan(rowBox!.y);
  });

  test('uses black graph icons in light mode and white graph icons when enabled or in dark mode', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('sma_theme', 'light'));
    await page.reload();
    await expect(page.locator('app-root')).toHaveClass(/light-theme/);

    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    const graphButton = aaplRow.getByRole('button', { name: 'Position graph' });
    await expect(graphButton).toBeVisible();

    const rgb = async () => graphButton.evaluate((element) => {
      const [r = 0, g = 0, b = 0] = getComputedStyle(element).color.match(/\d+/g)?.map(Number) || [];
      return { r, g, b };
    });

    const idleColor = await rgb();
    expect(Math.max(idleColor.r, idleColor.g, idleColor.b)).toBeLessThan(32);

    await graphButton.click();
    await expect(graphButton).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => {
      const activeColor = await rgb();
      return Math.min(activeColor.r, activeColor.g, activeColor.b);
    }).toBeGreaterThan(240);

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('button', { name: 'Dark mode' }).click();
    await expect(page.locator('app-root')).toHaveClass(/dark-theme/);
    await expect.poll(async () => {
      const darkColor = await rgb();
      return Math.min(darkColor.r, darkColor.g, darkColor.b);
    }).toBeGreaterThan(240);
  });

  test('opens a watch-only graph line from the graph button', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const watchRow = portfolio.locator('.stock-row').filter({ hasText: 'TSLA' });
    await expect(watchRow).toBeVisible();
    await expect(watchRow).toHaveAttribute('tabindex', '0');

    await watchRow.click({ position: { x: 12, y: 12 } });
    await expect(watchRow.locator('.position-chart-row')).toHaveCount(0);
    expect(api.calls['GET /stocks/TSLA/history'] || 0).toBe(0);

    await watchRow.getByRole('button', { name: 'Position graph' }).click();
    await expect(watchRow.locator('.position-chart-row')).toBeVisible();
    await expect.poll(() => api.calls['GET /stocks/TSLA/history'] || 0).toBe(1);
  });

  test('shows title metrics, tooltip title, and left-side text without wrapping', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
    await expect(aaplRow).toBeVisible();

    const symbol = aaplRow.locator('.ticket-type-indicator');
    await expect(symbol).toHaveAttribute('data-tooltip', 'Apple Inc.');
    await expect(symbol).toHaveAttribute('aria-label', 'Apple Inc.');
    await expect(symbol).not.toHaveAttribute('data-tooltip', /TOTAL:/);
    await expect(symbol).not.toHaveAttribute('data-tooltip', /Original:/);

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
    await expect(titleLines).toHaveAttribute('data-tooltip', /Current shows the current market value/);
    await expect(titleLines).toHaveAttribute('data-tooltip', /Original shows the invested cost/);
    await expect(titleLines).not.toHaveAttribute('data-tooltip', /\$2\.4K/);
    await expect(titleLines).not.toHaveAttribute('data-tooltip', /16\.59%/);
    await expect(titleLines).toContainText('Current');
    await expect(titleLines).toContainText('12 × $198.2 =');
    await expect(titleLines).toContainText('$2.4K');
    await expect(titleLines).toContainText('16.59%');
    const titleValueClasses = await titleLines.locator('.position-title-value').evaluateAll((elements) =>
      elements.map((element) => element.className),
    );
    expect(titleValueClasses.every((className) => !/value-pos|value-neg/.test(className))).toBe(true);
    const currentArrow = titleLines.locator('.position-title-line-primary .position-title-arrow');
    await expect(currentArrow).toHaveText('↑');
    await expect(currentArrow).toHaveClass(/value-pos/);
    await expect(titleLines.locator('.position-title-line-primary .position-title-percent')).toHaveClass(/value-pos/);
    await expect(titleLines).toContainText('Original');
    await expect(titleLines).toContainText('12 × $170 =');
    await expect(titleLines).toContainText('$2K');
    await expect(titleLines.locator('.position-title-label').first()).toHaveCSS('margin-right', '4px');
    await expect(titleLines.locator('.position-title-factor')).toHaveCount(4);
    await expect(titleLines.locator('.position-title-quantity-factor')).toHaveCount(2);
    await expect(titleLines.locator('.position-title-current-price-factor')).toHaveCount(1);
    await expect(titleLines.locator('.position-title-average-factor')).toHaveCount(1);

    const primaryColor = await page.locator('app-root').evaluate((root) => {
      const probe = document.createElement('span');
      probe.style.color = getComputedStyle(root).getPropertyValue('--primary');
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    const factorStyles = await titleLines.locator('.position-title-factor').evaluateAll((elements) =>
      elements.map((element) => ({
        color: getComputedStyle(element).color,
        fontWeight: Number(getComputedStyle(element).fontWeight),
      })),
    );
    expect(factorStyles.every((style) => style.fontWeight >= 700)).toBe(true);
    const quantityStyles = await titleLines.locator('.position-title-quantity-factor').evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).color),
    );
    const currentPriceColor = await titleLines.locator('.position-title-current-price-factor').evaluate((element) => getComputedStyle(element).color);
    const averageColor = await titleLines.locator('.position-title-average-factor').evaluate((element) => getComputedStyle(element).color);
    expect(quantityStyles.every((color) => color === 'rgb(0, 0, 0)')).toBe(true);
    expect(currentPriceColor).toBe(primaryColor);
    expect(averageColor).toBe(primaryColor);

    const rowBox = await aaplRow.boundingBox();
    const titleLinesBox = await titleLines.boundingBox();
    expect(rowBox).not.toBeNull();
    expect(titleLinesBox).not.toBeNull();
    expect(titleLinesBox!.width).toBeLessThan(rowBox!.width / 2);

    const nowrapValues = await Promise.all([
      todayMetric.evaluate((element) => getComputedStyle(element).whiteSpace),
      titleLines.locator('.position-title-line').first().evaluate((element) => getComputedStyle(element).whiteSpace),
    ]);
    expect(nowrapValues).toEqual(['nowrap', 'nowrap']);

    const tooltip = page.getByRole('tooltip');
    await todayMetric.hover();
    await expect(tooltip).toHaveText('Today');
    await expect(tooltip).toBeVisible();

    await titleLines.focus();
    await expect(tooltip).toContainText('Current shows the current market value');
    const tooltipBox = await tooltip.boundingBox();
    const viewport = page.viewportSize();
    expect(tooltipBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(0);
    expect(tooltipBox!.x + tooltipBox!.width).toBeLessThanOrEqual(viewport!.width);
    expect(tooltipBox!.y + tooltipBox!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test('shows watch-only daily change and current price without invested or position-total math', async ({ page }) => {
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
    const titleLines = watchRow.locator('.position-title-lines');
    await expect(titleLines).toContainText('Current');
    await expect(titleLines).toContainText('$200');
    await expect(titleLines).not.toContainText('Original');
    await expect(titleLines).not.toContainText('×');
    await expect(titleLines.locator('.position-title-current-price-factor')).toHaveCount(1);
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
    await expect(aaplRow.locator('.metric-30d')).toHaveAttribute('data-tooltip', /percentage price change over the last 30 calendar days/);
    await expect(aaplRow.locator('.risk-pe')).toHaveAttribute('data-tooltip', /trailing price-to-earnings ratio/);
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
    await page.evaluate(() => localStorage.setItem('sma_collapsed_positions', JSON.stringify(['1'])));
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
    const portfolio = page.getByLabel('Portfolio tickers');
    const aaplRow = portfolio.locator('.stock-row').filter({ hasText: 'AAPL' });
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

    await page.getByRole('button', { name: 'Open menu' }).click();
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
