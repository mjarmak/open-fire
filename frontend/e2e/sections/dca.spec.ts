import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('DCA Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('opens DCA configuration and saves enabled state', async ({ page }) => {
    const dcaPanel = page.getByLabel('DCA reminder settings');
    await dcaPanel.getByRole('button', { name: 'Configure' }).click();

    const dialog = page.locator('.dca-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Sent on your selected reminder days. Telegram is optional.')).toBeVisible();
    await expect(dialog.getByText('Remind me to review my portfolio after 7 days without opening OpenFIRE.')).toBeVisible();
    await expect(dialog.getByText('Sent to your verified Jenius account email.')).toHaveCount(0);
    await dialog.getByRole('checkbox', { name: 'Telegram DCA reminders (optional)' }).check();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    await expect(dcaPanel.getByText('Enabled')).toBeVisible();
  });

  test('opens suggestion dialog and copies a sample into the note', async ({ page }) => {
    const dcaPanel = page.getByLabel('DCA reminder settings');
    await dcaPanel.getByRole('button', { name: 'Configure' }).click();

    const dcaDialog = page.locator('.dca-dialog');
    const textarea = dcaDialog.getByRole('textbox', { name: 'DCA Note (shown first in reminders)' });
    const before = await textarea.inputValue();

    await dcaDialog.getByRole('button', { name: 'Suggest' }).click();
    const suggestionsDialog = page.locator('.dca-suggestions-dialog');
    await expect(suggestionsDialog).toBeVisible();

    await suggestionsDialog.getByRole('button', { name: 'Copy' }).first().click();
    await expect(suggestionsDialog).toBeHidden();

    const after = await textarea.inputValue();
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  for (const width of [390, 1280]) {
    test(`places Telegram above App Notifications in DCA settings at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.getByLabel('DCA reminder settings').getByRole('button', { name: 'Configure' }).click();
      const dialog = page.locator('.dca-dialog');
      const telegram = dialog.getByRole('button', { name: 'Configure Telegram Alerts', exact: true });
      const telegramBox = (await telegram.boundingBox())!;
      const appBox = (await dialog.getByRole('button', { name: 'App Notifications', exact: true }).boundingBox())!;
      expect(telegramBox.y + telegramBox.height).toBeLessThanOrEqual(appBox.y);
      expect(telegramBox.x).toBe(appBox.x);
      expect(telegramBox.width).toBe(appBox.width);
      await expect(dialog.locator('.dialog-heading').getByRole('button', { name: 'Configure Telegram Alerts' })).toHaveCount(0);
      await telegram.click();
      const settings = page.getByRole('dialog', { name: 'Telegram Configuration' });
      await expect(settings).toBeVisible();
      await expect(settings.getByLabel('Chat ID')).toBeEditable();
    });
  }

  test('saves email reminders independently of Telegram and restores them', async ({ page }) => {
    const panel = page.getByLabel('DCA reminder settings');
    await panel.getByRole('button', { name: 'Configure' }).click();
    const dialog = page.locator('.dca-dialog');
    await dialog.getByRole('checkbox', { name: 'Telegram DCA reminders (optional)' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'DCA reminder emails', exact: true }).check();
    await dialog.getByRole('checkbox', { name: 'Reminder emails', exact: true }).check();
    const saved = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith('/users/me/dca'));
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const payload = (await saved).postDataJSON();
    expect(payload.emailDcaEnabled).toBe(true);
    expect(payload.emailReturnEnabled).toBe(true);
    expect(payload.telegramDcaEnabled).toBe(false);
    await expect(panel.getByText('Enabled', { exact: true })).toBeVisible();
    await page.reload();
    await panel.getByRole('button', { name: 'Configure' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'DCA reminder emails', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Reminder emails', exact: true })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Telegram DCA reminders (optional)' })).not.toBeChecked();
  });
});
