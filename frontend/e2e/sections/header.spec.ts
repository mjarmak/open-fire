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

  test('logout returns user to welcome screen', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
  });
});
