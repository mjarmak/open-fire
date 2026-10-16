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

  for (const width of [320, 390, 768, 1280]) {
    test(`keeps the active alerts close button in the top-right corner at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await page.getByRole('button', { name: /active alerts/i }).click();
      const dialog = page.getByRole('dialog', { name: 'Active Alerts', exact: true });
      const close = dialog.getByTitle('Close dialog', { exact: true });
      await expect(close).toBeVisible();
      const bounds = await dialog.evaluate(element => {
        const css = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top + parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop),
          right: rect.right - parseFloat(css.borderRightWidth) - parseFloat(css.paddingRight),
        };
      });
      const closeBox = (await close.boundingBox())!;
      expect(Math.abs(closeBox.y - bounds.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(closeBox.x + closeBox.width - bounds.right)).toBeLessThanOrEqual(1);
      for (const name of ['Alert Notification Settings']) {
        const button = dialog.getByRole('button', { name, exact: true });
        await expect(button).toBeVisible();
        const box = (await button.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(closeBox.y + closeBox.height);
      }
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('active-alerts.png') });
      await close.click();
      await expect(dialog).toBeHidden();
    });
  }

  test('opens telegram settings from alerts and saves chat id', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();

    const telegramDialog = page.getByRole('dialog', { name: 'Telegram Configuration' });
    await expect(telegramDialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Alert Notification Settings', exact: true })).toBeHidden();
    await telegramDialog.getByLabel('Chat ID').fill('123456789');
    await telegramDialog.getByRole('button', { name: 'Save' }).click();
    await expect(telegramDialog).toBeHidden();
    await expect(page.getByText('Telegram settings saved.')).toBeVisible();
  });

  test('runs telegram test action', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
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
        const telegramButton = (await dialog.getByRole('button', { name: 'Configure Telegram Alerts', exact: true }).boundingBox())!;
        const appButton = (await dialog.getByRole('button', { name: 'App Notifications', exact: true }).boundingBox())!;
        expect(telegramButton.y + telegramButton.height).toBeLessThanOrEqual(appButton.y);
        expect(telegramButton.x).toBe(appButton.x);
        expect(telegramButton.width).toBe(appButton.width);
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
        await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
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
    await page.getByRole('button', { name: 'Alert Notification Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();
    const telegram = page.getByRole('dialog', { name: 'Telegram Configuration' });
    await expect(telegram.getByLabel('Chat ID')).toHaveValue('1547812774');
    await expect(telegram.getByText('Alert briefing days')).toHaveCount(0);
  });
});
