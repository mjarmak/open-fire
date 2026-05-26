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

    const telegramDialog = page.getByRole('dialog', { name: 'Telegram' });
    await expect(telegramDialog).toBeVisible();
    await telegramDialog.getByLabel('Chat ID').fill('123456789');
    await telegramDialog.getByRole('button', { name: 'Save' }).click();
    await expect(telegramDialog).toBeHidden();
    await expect(page.getByText('Telegram chat ID saved.')).toBeVisible();
  });

  test('runs telegram test action', async ({ page }) => {
    await page.getByRole('button', { name: /active alerts|Alerts/ }).click();
    await page.getByRole('button', { name: 'Configure Telegram Alerts' }).click();

    const telegramDialog = page.getByRole('dialog', { name: 'Telegram' });
    await telegramDialog.getByLabel('Chat ID').fill('123456789');
    await telegramDialog.getByRole('button', { name: 'Test' }).click();
    await expect(page.getByText('Telegram test sent.')).toBeVisible();
  });
});
