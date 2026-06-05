import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Indicators Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
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
    await expect(indicatorGrid.locator('.retirement-progress-indicator')).toContainText('of target');
    await expect(indicatorGrid.locator('.indicator-help')).toHaveCount(3);
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
