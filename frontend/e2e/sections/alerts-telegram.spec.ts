import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Alerts & Telegram Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('opens alerts dialog and shows watch-only labels', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    const alertsDialog = page.getByRole('dialog', { name: 'Active Alerts' });
    await expect(alertsDialog).toBeVisible();
    await expect(alertsDialog.locator('.watch-only-badge').filter({ hasText: 'Watch only' }).first()).toBeVisible();
    await expect(alertsDialog.getByText('MSFT')).toBeVisible();
  });

  test('opens telegram settings from alerts and saves chat id', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();

    const telegramDialog = page.getByRole('dialog', { name: 'Telegram Configuration' });
    await expect(telegramDialog).toBeVisible();
    await telegramDialog.getByLabel('Chat ID').fill('123456789');
    await telegramDialog.getByRole('button', { name: 'Save' }).click();
    await expect(telegramDialog).toBeHidden();
    await expect(page.getByText('Telegram settings saved.')).toBeVisible();
  });

  test('runs telegram test action', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();

    const telegramDialog = page.getByRole('dialog', { name: 'Telegram Configuration' });
    await telegramDialog.getByLabel('Chat ID').fill('123456789');
    await telegramDialog.getByRole('button', { name: 'Test' }).click();
    await expect(page.getByText('Telegram test sent.')).toBeVisible();
  });

  for (const theme of ['light', 'dark']) {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      test(`aligns alert settings with shared dialog styling in ${theme} mode at ${viewport.width}px`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await page.evaluate(value => localStorage.setItem('sma_theme', value), theme);
        await page.reload();
        await page.getByRole('button', { name: /active alerts/i }).click();
        await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Alert Notification Settings' });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
        const style = await dialog.evaluate(element => {
          const css = getComputedStyle(element);
          return { width: css.width, padding: css.padding, borderRadius: css.borderRadius,
            background: css.backgroundColor, shadow: css.boxShadow };
        });
        expect(parseFloat(style.width)).toBe(viewport.width > 560 ? 560 : viewport.width - 24);
        const heading = await dialog.getByRole('heading').boundingBox();
        const close = await dialog.getByRole('button', { name: 'Close dialog' }).boundingBox();
        expect(heading!.x + heading!.width).toBeLessThanOrEqual(close!.x);
        await page.screenshot({ path: testInfo.outputPath('alert-settings.png') });
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await page.getByRole('button', { name: /active alerts/i }).click();
        await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();
        const telegramStyle = await page.getByRole('dialog', { name: 'Telegram Configuration' }).evaluate(element => {
          const css = getComputedStyle(element);
          return { width: css.width, padding: css.padding, borderRadius: css.borderRadius,
            background: css.backgroundColor, shadow: css.boxShadow };
        });
        expect(style).toEqual(telegramStyle);
      });
    }
  }

  test('saves briefing days separately without changing the Telegram chat ID', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Alert Notification Settings' });
    await expect(settings).toBeVisible();
    await expect(settings.getByLabel('Chat ID')).toHaveCount(0);
    await settings.getByText('Mon', { exact: true }).click();
    const saved = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/users/me/alert-notifications'));
    await settings.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).postDataJSON()).toEqual({ alertDays: ['TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] });
    await page.reload();
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
    await expect(settings.getByRole('checkbox', { name: 'Mon', exact: true })).not.toBeChecked();
    await settings.getByRole('button', { name: 'Cancel' }).click();
    await expect(settings).toBeHidden();
    await page.getByRole('button', { name: /active alerts/i }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();
    const telegram = page.getByRole('dialog', { name: 'Telegram Configuration' });
    await expect(telegram.getByLabel('Chat ID')).toHaveValue('1547812774');
    await expect(telegram.getByText('Alert briefing days')).toHaveCount(0);
  });
});
