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
    await expect(dialog.getByText('When enabled, DCA reminders are emailed to your verified Jenius account email on the selected days. Telegram is an optional extra.')).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Also send DCA reminders on Telegram (optional)' }).check();
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

  test('saves email reminders independently of Telegram and restores them', async ({ page }) => {
    const panel = page.getByLabel('DCA reminder settings');
    await panel.getByRole('button', { name: 'Configure' }).click();
    const dialog = page.locator('.dca-dialog');
    await dialog.getByRole('checkbox', { name: 'Also send DCA reminders on Telegram (optional)' }).uncheck();
    await dialog.getByRole('checkbox', { name: 'Email my DCA reminder' }).check();
    await dialog.getByRole('checkbox', { name: 'Email me after a week away' }).check();
    const saved = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith('/users/me/dca'));
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    const payload = (await saved).postDataJSON();
    expect(payload.emailDcaEnabled).toBe(true);
    expect(payload.emailReturnEnabled).toBe(true);
    expect(payload.telegramDcaEnabled).toBe(false);
    await expect(panel.getByText('Enabled', { exact: true })).toBeVisible();
    await page.reload();
    await panel.getByRole('button', { name: 'Configure' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Email my DCA reminder' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Email me after a week away' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Also send DCA reminders on Telegram (optional)' })).not.toBeChecked();
  });
});
