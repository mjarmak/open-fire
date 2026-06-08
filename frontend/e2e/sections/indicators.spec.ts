import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Indicators Section', () => {
  let api: Awaited<ReturnType<typeof registerMockApi>>;

  test.beforeEach(async ({ page }) => {
    api = await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('renders volatility and credit cards with values', async ({ page }) => {
    const indicatorGrid = page.getByLabel('Macro market indicators');
    await expect(indicatorGrid).toBeVisible();
    await expect(indicatorGrid.getByRole('heading', { name: 'Fear Index / VIX' })).toBeVisible();
    await expect(indicatorGrid.getByRole('heading', { name: 'Credit Market' })).toBeVisible();
    await expect(indicatorGrid.getByText('index points')).toBeVisible();
    await expect(indicatorGrid.getByText('spread %')).toBeVisible();
  });

  test('renders compact speedometer gauges for macro and retirement progress', async ({ page }) => {
    const indicatorGrid = page.getByLabel('Macro market indicators');
    const compactCards = indicatorGrid.locator('.compact-indicator');
    await expect(compactCards).toHaveCount(3);
    await expect(compactCards.locator('.mini-speedometer')).toHaveCount(3);
    await expect(indicatorGrid.locator('.retirement-progress-indicator')).toContainText('Progress');
    await expect(indicatorGrid.locator('.retirement-progress-indicator')).toContainText('of $900K');
    await expect(indicatorGrid.locator('.indicator-help')).toHaveCount(0);

    const vixCard = compactCards.filter({ hasText: 'Fear Index / VIX' });
    await expect(vixCard).toHaveAttribute('data-tooltip', 'Volatility benchmark for broad market stress. Risk threshold: 25 index points or +3 daily change.');
    await expect.poll(() => vixCard.locator('.mini-speedometer').evaluate((element) => ({
      riskStart: getComputedStyle(element).getPropertyValue('--gauge-risk-start').trim(),
      riskEnd: getComputedStyle(element).getPropertyValue('--gauge-risk-end').trim(),
    }))).toEqual({ riskStart: '60deg', riskEnd: '180deg' });
    await vixCard.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Volatility benchmark for broad market stress. Risk threshold: 25 index points or +3 daily change.');

    const creditCard = compactCards.filter({ hasText: 'Credit Market' });
    await expect(creditCard).toHaveAttribute('data-tooltip', 'Tracks corporate bond spread pressure. Risk threshold: 2.0 spread % or +0.15 daily change.');

    const retirementCard = indicatorGrid.locator('.retirement-progress-indicator');
    await expect(retirementCard).toHaveAttribute('data-tooltip', /Current non-watch-only portfolio value/);
    await expect(retirementCard).toHaveAttribute('data-tooltip', /Target Retirement Fund/);
    await expect(retirementCard).toHaveAttribute('data-tooltip', /\$900K/);
    await expect.poll(() => retirementCard.locator('.mini-speedometer').evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--gauge-sweep').trim(),
    )).toBe('0deg');
    await expect.poll(() => retirementCard.locator('.retirement-speedometer').evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).getPropertyValue('--gauge-needle')),
    )).toBeLessThan(-170);
    await retirementCard.hover();
    await expect(page.getByRole('tooltip')).toContainText('Current non-watch-only portfolio value');
    await expect(page.getByRole('tooltip')).toContainText('Target Retirement Fund');
  });

  test('keeps all compact gauge containers the same size', async ({ page }) => {
    api.state.indicators = [
      ...api.state.indicators,
      {
        id: 'fear-greed',
        name: 'Fear & Greed Index',
        category: 'COMPOSITE',
        value: 48,
        unit: '0 fear / 100 greed',
        change: -1,
        status: 'neutral',
        source: 'Mock',
        lastUpdated: new Date().toISOString(),
        description: 'Composite risk appetite measure.',
      },
      {
        id: 'breadth',
        name: 'Market Breadth',
        category: 'PARTICIPATION',
        value: 56,
        unit: '% advancing basket',
        change: 0,
        status: 'supportive',
        source: 'Mock',
        lastUpdated: new Date().toISOString(),
        description: 'Market participation measure.',
      },
      {
        id: 'correlation',
        name: 'Cross-Asset Correlation',
        category: 'RISK REGIME',
        value: 0.64,
        unit: 'avg abs corr',
        change: 0,
        status: 'watch',
        source: 'Mock',
        lastUpdated: new Date().toISOString(),
        description: 'Cross-asset diversification stress measure.',
      },
    ];
    await page.reload();
    await expect(page.getByLabel('Macro market indicators')).toBeVisible();

    const indicatorGrid = page.getByLabel('Macro market indicators');
    const compactCards = indicatorGrid.locator('.compact-indicator');
    await expect(compactCards).toHaveCount(6);

    const cardSizes = await compactCards.evaluateAll((cards) =>
      cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    const speedometerSizes = await compactCards.locator('.mini-speedometer').evaluateAll((gauges) =>
      gauges.map((gauge) => {
        const box = gauge.getBoundingClientRect();
        return { width: box.width, height: box.height };
      }),
    );
    const [firstCard] = cardSizes;
    const [firstSpeedometer] = speedometerSizes;

    expect(cardSizes.every((size) =>
      Math.abs(size.width - firstCard.width) <= 1 && Math.abs(size.height - firstCard.height) <= 1,
    )).toBe(true);
    expect(speedometerSizes.every((size) =>
      Math.abs(size.width - firstSpeedometer.width) <= 1 && Math.abs(size.height - firstSpeedometer.height) <= 1,
    )).toBe(true);
  });

  test('shows both global risk charts below the pie chart with range controls', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('sma_theme', 'light'));
    await page.reload();
    await expect(page.locator('app-root')).toHaveClass(/light-theme/);

    const indicatorGrid = page.getByLabel('Macro market indicators');
    const vixCard = indicatorGrid.locator('.compact-indicator').filter({ hasText: 'Fear Index / VIX' });
    await expect(vixCard).toBeVisible();

    await expect.poll(() => api.calls['GET /indicators/vix/history'] || 0).toBeGreaterThan(0);
    await expect.poll(() => api.calls['GET /indicators/credit/history'] || 0).toBeGreaterThan(0);
    const initialVixHistoryCalls = api.calls['GET /indicators/vix/history'] || 0;
    const initialCreditHistoryCalls = api.calls['GET /indicators/credit/history'] || 0;
    await expect(vixCard.locator('.indicator-chart-panel')).toHaveCount(0);

    const portfolioBoard = page.getByLabel('Portfolio tickers');
    const globalCharts = portfolioBoard.locator('.global-risk-chart-panel');
    const vixChart = portfolioBoard.locator('.global-risk-chart-panel[aria-label*="Fear Index / VIX"]');
    const creditChart = portfolioBoard.locator('.global-risk-chart-panel[aria-label*="Credit Market"]');
    await expect(globalCharts).toHaveCount(2);
    await expect(vixChart).toBeVisible();
    await expect(creditChart).toBeVisible();
    await expect(portfolioBoard.locator('.global-risk-chart-heading')).toHaveCount(2);
    await expect(vixChart.locator('.global-risk-chart-heading')).toContainText('Fear Index / VIX');
    await expect(vixChart.locator('.chart-range-options button')).toHaveCount(5);
    await expect(vixChart.locator('.chart-range-options button.active')).toHaveText('1y');

    await vixChart.locator('.chart-range-options button', { hasText: '10y' }).click();
    await expect(vixChart.locator('.chart-range-options button.active')).toHaveText('10y');
    await expect.poll(() => api.calls['GET /indicators/vix/history'] || 0).toBe(initialVixHistoryCalls + 1);
    expect(api.calls['GET /indicators/credit/history'] || 0).toBe(initialCreditHistoryCalls);

    await vixChart.locator('.chart-range-options button', { hasText: '1y' }).click();
    await expect(vixChart.locator('.chart-range-options button.active')).toHaveText('1y');
    await page.waitForTimeout(100);
    expect(api.calls['GET /indicators/vix/history'] || 0).toBe(initialVixHistoryCalls + 1);

    const gridBox = await indicatorGrid.boundingBox();
    const portfolioBox = await portfolioBoard.boundingBox();
    const chartPanelBox = await vixChart.boundingBox();
    const chartSvgBox = await vixChart.locator('.range-trend-svg').boundingBox();
    const trendLineBox = await vixChart.locator('.range-trend-svg .trend-line').boundingBox();
    expect(gridBox).not.toBeNull();
    expect(portfolioBox).not.toBeNull();
    expect(chartPanelBox).not.toBeNull();
    expect(chartSvgBox).not.toBeNull();
    expect(trendLineBox).not.toBeNull();
    expect(chartPanelBox!.width).toBeGreaterThan(portfolioBox!.width - 24);
    expect(await vixChart.evaluate((element) => getComputedStyle(element).borderStyle)).toBe('solid');
    expect(await vixChart.evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px');
    expect(chartSvgBox!.width).toBeGreaterThan(chartPanelBox!.width * 0.55);
    expect(trendLineBox!.width).toBeGreaterThan(chartSvgBox!.width * 0.75);
    await expect.poll(() => portfolioBoard.evaluate((element) => {
      const piePanel = element.querySelector('.position-type-panel');
      const chartPanels = element.querySelectorAll('.global-risk-chart-panel');
      const stockTable = element.querySelector('.stock-table');
      return Boolean(
        piePanel
          && chartPanels.length === 2
          && stockTable
          && (piePanel.compareDocumentPosition(chartPanels[0]) & Node.DOCUMENT_POSITION_FOLLOWING)
          && (chartPanels[1].compareDocumentPosition(stockTable) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
    })).toBe(true);
    await expect(vixChart.locator('.range-trend-svg .trend-line')).toHaveAttribute('d', /L/);
    await expect(vixChart.locator('.trend-x-axis-label')).toHaveCount(3);
    await expect(vixChart.locator('.trend-y-axis-label')).toHaveCount(5);
    await expect(vixChart.locator('.trend-y-axis-unit')).toHaveText('index points');
    const yAxisLabelText = await vixChart.locator('.trend-y-axis-label').allTextContents();
    expect(yAxisLabelText.every((label) => !label.includes('index points'))).toBe(true);
    await vixChart.locator('.range-trend-container').hover({ position: { x: 320, y: 52 } });
    const tooltip = vixChart.locator('.range-trend-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Value');
    const tooltipTextBrightness = await tooltip.evaluate((element) => {
      const brightness = (selector: string) => {
        const target = element.querySelector(selector);
        if (!target) return 0;
        const match = getComputedStyle(target).color.match(/\d+/g)?.map(Number) || [];
        return match.length >= 3 ? (match[0] + match[1] + match[2]) / 3 : 0;
      };
      const fontSize = (selector: string) => {
        const target = element.querySelector(selector);
        return target ? Number.parseFloat(getComputedStyle(target).fontSize) : 0;
      };
      return {
        title: brightness('.tooltip-title'),
        label: brightness('.label'),
        value: brightness('.val'),
        titleSize: fontSize('.tooltip-title'),
        labelSize: fontSize('.label'),
        valueSize: fontSize('.val'),
      };
    });
    expect(tooltipTextBrightness.title).toBeGreaterThan(180);
    expect(tooltipTextBrightness.label).toBeGreaterThan(180);
    expect(tooltipTextBrightness.value).toBeGreaterThan(180);
    expect(tooltipTextBrightness.titleSize).toBeLessThanOrEqual(10);
    expect(tooltipTextBrightness.labelSize).toBeLessThanOrEqual(11);
    expect(tooltipTextBrightness.valueSize).toBeLessThanOrEqual(11);
  });

  test('keeps the compact indicator grid inside a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const indicatorGrid = page.getByLabel('Macro market indicators');
    await expect(indicatorGrid.locator('.compact-indicator')).toHaveCount(3);
    await expect.poll(() => indicatorGrid.evaluate((element) => {
      const gridBounds = element.getBoundingClientRect();
      return Array.from(element.querySelectorAll('.compact-indicator')).every((card) => {
        const cardBounds = card.getBoundingClientRect();
        return cardBounds.left >= gridBounds.left - 1 && cardBounds.right <= gridBounds.right + 1;
      });
    })).toBe(true);
  });

  test('keeps always visible indicator graphs readable in a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const indicatorGrid = page.getByLabel('Macro market indicators');
    const creditCard = indicatorGrid.locator('.compact-indicator').filter({ hasText: 'Credit Market' });
    await expect(creditCard).toBeVisible();

    const globalChart = page.getByLabel('Portfolio tickers').locator('.global-risk-chart-panel[aria-label*="Credit Market"]');
    await expect(globalChart).toBeVisible();
    const svgBox = await globalChart.locator('.range-trend-svg').boundingBox();
    const trendLineBox = await globalChart.locator('.range-trend-svg .trend-line').boundingBox();
    expect(svgBox).not.toBeNull();
    expect(trendLineBox).not.toBeNull();
    expect(svgBox!.height).toBeGreaterThan(78);
    expect(svgBox!.width).toBeGreaterThan(300);
    expect(trendLineBox!.width).toBeGreaterThan(svgBox!.width * 0.7);
    await expect(globalChart.locator('.trend-y-axis-unit')).toHaveText('spread %');
    const yAxisLabelText = await globalChart.locator('.trend-y-axis-label').allTextContents();
    expect(yAxisLabelText.every((label) => !label.includes('spread'))).toBe(true);
  });

  test('keeps section title h2 sizes consistent while compact gauge titles stay smaller', async ({ page }) => {
    const dcaTitle = page.getByLabel('DCA reminder settings').locator('h2');
    const portfolioTitle = page.getByLabel('Portfolio tickers').locator('h2').filter({ hasText: 'Portfolio' });
    const retirementTitle = page.getByLabel('Retirement planner').locator('h2');
    const gaugeTitle = page.getByLabel('Macro market indicators').locator('.compact-indicator h2').first();

    const sizes = await Promise.all([
      dcaTitle.evaluate((element) => getComputedStyle(element).fontSize),
      portfolioTitle.evaluate((element) => getComputedStyle(element).fontSize),
      retirementTitle.evaluate((element) => getComputedStyle(element).fontSize),
      gaugeTitle.evaluate((element) => getComputedStyle(element).fontSize),
    ]);
    const [dcaSize, portfolioSize, retirementSize, gaugeSize] = sizes.map((size) => Number.parseFloat(size));

    expect(dcaSize).toBe(portfolioSize);
    expect(portfolioSize).toBe(retirementSize);
    expect(gaugeSize).toBeLessThan(portfolioSize);
  });
});
