import { test, expect } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi } from './fixtures/mock-api';

const shouldCapture = process.env['CAPTURE_PLAY_STORE_SCREENSHOTS'] === '1';

test.describe('Play Store listing captures', () => {
  test.skip(!shouldCapture, 'Set CAPTURE_PLAY_STORE_SCREENSHOTS=1 to refresh listing screenshots.');

  test('captures the welcome and dashboard phone views', async ({ browser }) => {
    const viewport = { width: 360, height: 640 };
    const contextOptions = { viewport, deviceScaleFactor: 3 };

    const welcomeContext = await browser.newContext(contextOptions);
    const welcomePage = await welcomeContext.newPage();
    await welcomePage.addInitScript(() => {
      localStorage.setItem('jeniusapps-analytics-consent', 'denied');
    });
    await welcomePage.goto('/');
    await expect(welcomePage.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
    await welcomePage.screenshot({ path: '../store-listing/assets/phone-welcome.png' });
    await welcomeContext.close();

    const dashboardContext = await browser.newContext(contextOptions);
    const dashboardPage = await dashboardContext.newPage();
    await registerMockApi(dashboardPage);
    await gotoLoggedInDashboard(dashboardPage);
    await dashboardPage.waitForTimeout(1500);
    await dashboardPage.screenshot({ path: '../store-listing/assets/phone-dashboard.png' });
    await dashboardContext.close();
  });
});
