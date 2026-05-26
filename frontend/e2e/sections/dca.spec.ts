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
    await dialog.getByRole('checkbox', { name: 'Enable Telegram DCA reminder' }).check();
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(dialog).toBeHidden();
    await expect(dcaPanel.getByText('Enabled')).toBeVisible();
  });

  test('opens suggestion dialog and copies a sample into the note', async ({ page }) => {
    const dcaPanel = page.getByLabel('DCA reminder settings');
    await dcaPanel.getByRole('button', { name: 'Configure' }).click();

    const dcaDialog = page.locator('.dca-dialog');
    const textarea = dcaDialog.getByRole('textbox', { name: 'DCA Note (shown first in Telegram reminder)' });
    const before = await textarea.inputValue();

    await dcaDialog.getByRole('button', { name: 'Suggest' }).click();
    const suggestionsDialog = page.locator('.dca-suggestions-dialog');
    await expect(suggestionsDialog).toBeVisible();

    await suggestionsDialog.getByRole('button', { name: 'Copy' }).first().click();
    await expect(suggestionsDialog).toBeHidden();

    const after = await textarea.inputValue();
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });
});
