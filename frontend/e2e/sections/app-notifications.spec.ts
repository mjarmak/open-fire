import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('App notifications', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page); await seedRememberedLogin(page); await gotoLoggedInDashboard(page);
  });

  test('loads settings directly without an inbox and saves with snackbar feedback', async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => release = resolve);
    let inboxRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/notifications/app') inboxRequests++; });
    await page.route('**/api/notifications/app/settings', async route => {
      if (route.request().method() === 'GET') {
        await pending;
        await route.fulfill({ json: { configured: false, publicKey: '', preferences: { dca: false, briefing: false, returnReminder: false } } });
      } else { await route.fallback(); }
    });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'App Notifications', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'App Notifications' });
    await expect(dialog.getByRole('status', { name: 'Loading notifications' })).toBeVisible();
    release();
    await expect(dialog.getByRole('checkbox', { name: 'DCA reminders', exact: true })).not.toBeChecked();
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Test notification' })).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'DCA reminders', exact: true }).check();
    const request = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/notifications/app/settings'));
    await dialog.getByRole('button', { name: 'Save preferences' }).click();
    expect((await request).postDataJSON()).toEqual({ dca: true, briefing: false, returnReminder: false });
    await expect(page.locator('.snackbar')).toHaveText('Notification preferences saved.');
    await expect(dialog.getByText('Notification preferences saved.')).toHaveCount(0);
    await expect(dialog.getByText('Push delivery is not configured yet.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Enable on this device' })).toBeDisabled();
    expect(inboxRequests).toBe(0);
  });

  test('shows load and save failures in an error snackbar, with retry', async ({ page }) => {
    await page.route('**/api/notifications/app/settings', route => route.fulfill({ status: 503, json: {} }));
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'App Notifications', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'App Notifications' });
    await expect(page.locator('.snackbar-error')).toHaveText('Could not load notification settings. Try again.');
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Save preferences' })).toHaveCount(0);
    await page.unroute('**/api/notifications/app/settings');
    await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(dialog.getByRole('checkbox', { name: 'DCA reminders', exact: true })).toBeVisible();
    await page.route('**/api/notifications/app/settings', route => route.fulfill({ status: 500, json: {} }));
    await dialog.getByRole('button', { name: 'Save preferences' }).click();
    await expect(page.locator('.snackbar-error')).toHaveText('Could not update notifications. Please try again.');
    await expect(dialog.getByText('Could not update notifications. Please try again.')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Save preferences' })).toBeEnabled();
  });

  for (const theme of ['dark', 'light']) {
    for (const width of [390, 1280]) {
      test(`renders settings and snackbar in ${theme} mode at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(value => localStorage.setItem('sma_theme', value), theme); await page.reload();
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('button', { name: 'App Notifications', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'App Notifications' });
        await expect(dialog.getByRole('checkbox')).toHaveCount(3);
        await expect(dialog.getByRole('tab')).toHaveCount(0);
        await dialog.getByRole('button', { name: 'Save preferences' }).click();
        const snackbar = page.locator('.snackbar');
        await expect(snackbar).toBeVisible();
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const toast = (await snackbar.boundingBox())!;
        expect(toast.x).toBeGreaterThanOrEqual(0); expect(toast.x + toast.width).toBeLessThanOrEqual(width);
        expect(await snackbar.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath('notifications.png') });
      });
    }
  }

  test('is reachable from the DCA configuration without stacked dialogs', async ({ page }) => {
    await page.getByRole('button', { name: 'Configure', exact: true }).first().click();
    const dca = page.getByRole('dialog', { name: 'Configure', exact: true });
    await dca.getByRole('button', { name: 'App Notifications', exact: true }).click();
    await expect(dca).toBeHidden(); await expect(page.getByRole('dialog', { name: 'App Notifications' })).toBeVisible();
  });
});
