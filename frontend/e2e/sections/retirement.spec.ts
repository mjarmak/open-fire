import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Retirement Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);
  });

  test('opens retirement configure dialog and saves values', async ({ page }) => {
    const retirementBoard = page.getByLabel('Retirement planner');
    await retirementBoard.getByRole('button', { name: 'Configure' }).click();

    const dialog = page.getByRole('dialog', { name: 'Retirement Settings' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Desired Monthly Retirement Income ($)').fill('4200');
    await dialog.getByLabel('Safe Withdrawal Rate (%)').fill('5');
    await dialog.getByLabel('Custom Desired Annual Return (%)').fill('11');
    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const saveButton = dialog.getByRole('button', { name: 'Save Settings' });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    await expect(dialog).toBeHidden();
    const configCard = retirementBoard.locator('.config-metric-card');
    await expect(configCard.getByText('$4.2K/mo', { exact: true })).toBeVisible();
    await expect(configCard.getByText('5%', { exact: true })).toBeVisible();
  });

  test('renders wealth projection chart and legend items', async ({ page }) => {
    const retirementBoard = page.getByLabel('Retirement planner');
    await expect(retirementBoard.locator('.projection-svg')).toBeVisible();
    await expect(retirementBoard.getByText('Realistic 10% Return')).toBeVisible();
    await expect(retirementBoard.getByText('Dotted = no salary withdrawals')).toBeVisible();
  });
});
