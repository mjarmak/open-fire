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

  test('shows compact indicator help buttons', async ({ page }) => {
    const helpButtons = page.locator('.indicator-grid .indicator-help');
    await expect(helpButtons).toHaveCount(2);
  });
});
