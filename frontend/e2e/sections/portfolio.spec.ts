import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Portfolio Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('adds, edits, collapses, and deletes a position', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await expect(addDialog).toBeVisible();
    const symbolInput = addDialog.locator('input[name="symbol"]');
    await symbolInput.fill('NVDA');
    await expect(addDialog.locator('.symbol-option').first()).toBeVisible({ timeout: 4_000 });
    await addDialog.locator('.symbol-option').first().click();
    await addDialog.getByRole('spinbutton', { name: 'Position' }).fill('3');
    await addDialog.getByRole('spinbutton', { name: 'Avg Cost' }).fill('900');
    await addDialog.getByRole('button', { name: 'Add' }).click();
    await expect(addDialog).toBeHidden();
    await expect(page.locator('.stock-row').filter({ hasText: 'NVDA' })).toBeVisible();

    const nvdaRow = page.locator('.stock-row').filter({ hasText: 'NVDA' });
    await nvdaRow.getByRole('button', { name: 'Collapse position' }).click();
    await expect(nvdaRow).toHaveClass(/collapsed-row/);
    await nvdaRow.getByRole('button', { name: 'Expand position' }).click();

    await nvdaRow.getByRole('button', { name: 'Edit position' }).click();
    const editDialog = page.getByRole('dialog', { name: 'NVDA' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('spinbutton', { name: 'Position' }).fill('5');
    await editDialog.getByRole('button', { name: 'Save' }).click();
    await expect(editDialog).toBeHidden();

    await nvdaRow.getByRole('button', { name: 'Remove holding' }).click();
    const deleteDialog = page.getByRole('alertdialog', { name: /Remove NVDA/ });
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('.stock-row').filter({ hasText: 'NVDA' })).toHaveCount(0);
  });

  test('supports watch-only entry plus export and import CSV', async ({ page }) => {
    const portfolio = page.getByLabel('Portfolio tickers');
    await portfolio.getByRole('button', { name: 'Add' }).click();

    const addDialog = page.getByRole('dialog', { name: 'Add Position' });
    await addDialog.locator('input[name="symbol"]').fill('TSLA');
    await expect(addDialog.locator('.symbol-option').first()).toBeVisible({ timeout: 4_000 });
    await addDialog.locator('.symbol-option').first().click();
    await addDialog.locator('input[name="watchOnly"]').check();
    await expect(addDialog.getByRole('spinbutton', { name: 'Position' })).toBeDisabled();
    await expect(addDialog.getByRole('spinbutton', { name: 'Avg Cost' })).toBeDisabled();
    await expect(addDialog.getByRole('button', { name: 'Add' })).toBeEnabled();
    await addDialog.getByRole('button', { name: 'Cancel' }).click();

    const downloadPromise = page.waitForEvent('download');
    await portfolio.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('portfolio-positions');

    const csvInput = portfolio.locator('input.file-input');
    await csvInput.setInputFiles({
      name: 'positions.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('symbol,companyName,quantity,averageCost,watchOnly\nAMZN,Amazon.com Inc.,4,130,false\n', 'utf8'),
    });

    await expect(page.getByText('position(s) imported from CSV', { exact: false })).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.stock-row').filter({ hasText: 'AMZN' })).toBeVisible();
  });
});
