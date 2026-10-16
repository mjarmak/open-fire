import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('App notifications', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page); await seedRememberedLogin(page); await gotoLoggedInDashboard(page);
  });

  test('shows loading then an empty inbox, with independent opt-in settings', async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => release = resolve);
    await page.route('**/api/notifications/app', async route => { await pending; await route.fulfill({ json: [] }); });
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await page.getByRole('button', { name: 'App Notifications', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'App Notifications' });
    await expect(dialog.getByRole('status', { name: 'Loading notifications' })).toBeVisible();
    await expect(dialog.getByText('No notifications yet.')).toHaveCount(0);
    release(); await expect(dialog.getByText('No notifications yet.')).toBeVisible();
    await dialog.getByRole('tab', { name: 'Settings' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'DCA reminders', exact: true })).not.toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Portfolio reminders after 7 days of inactivity', exact: true })).not.toBeChecked();
    await dialog.getByRole('checkbox', { name: 'DCA reminders', exact: true }).check();
    const request = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/notifications/app/settings'));
    await dialog.getByRole('button', { name: 'Save preferences' }).click();
    expect((await request).postDataJSON()).toEqual({ dca: true, briefing: false, returnReminder: false });
    await expect(dialog.getByText('Notification preferences saved.')).toBeVisible();
    await expect(dialog.getByText('Push delivery is not configured yet.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Enable on this device' })).toBeDisabled();
  });

  for (const theme of ['dark', 'light']) {
    for (const width of [390, 1280]) {
      test(`renders full notification content safely in ${theme} mode at ${width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(value => localStorage.setItem('sma_theme', value), theme); await page.reload();
        await page.route('**/api/notifications/app', route => route.fulfill({ json: [{ id: 42, kind: 'dca', title: 'Your OpenFIRE DCA reminder',
          body: '<img src=x onerror="alert(1)">\nPlanned DCA: $100/month\n' + 'Full briefing text. '.repeat(100), createdAt: '2026-10-16T14:00:00Z' }] }));
        await page.getByRole('button', { name: 'Open menu', exact: true }).click();
        await page.getByRole('button', { name: 'App Notifications', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'App Notifications' });
        await expect(dialog.getByRole('heading', { name: 'Your OpenFIRE DCA reminder' })).toBeVisible();
        await expect(dialog.locator('article img')).toHaveCount(0);
        await expect(dialog.locator('article p')).toContainText('Planned DCA: $100/month');
        const box = (await dialog.boundingBox())!; expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
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
