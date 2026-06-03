import { expect, test } from '@playwright/test';
import { gotoLoggedInDashboard, registerMockApi, seedRememberedLogin } from '../fixtures/mock-api';

test.describe('Retirement Section', () => {
  test('opens retirement configure dialog and saves values', async ({ page }) => {
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

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
    await registerMockApi(page);
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const retirementBoard = page.getByLabel('Retirement planner');
    await expect(retirementBoard.locator('.projection-svg')).toBeVisible();
    await expect(retirementBoard.getByText('Realistic 10% Return')).toBeVisible();
    await expect(retirementBoard.getByText('Dotted = no salary withdrawals')).toBeVisible();
  });

  test('renders summary, target, and config fields with Annualized Return% based on total invested', async ({ page }) => {
    await registerMockApi(page, {
      stocks: [{
        id: 1,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        positionType: 'Tech',
        quantity: 10,
        averageCost: 200,
        latestPrice: 200,
        marketCap: 2_900_000_000_000,
        peRatio: 29.1,
        beta: 1.19,
        realizedVolatilityPercent: 22.4,
        drawdownPercent: 8.6,
        fearScore: 63,
        marketValue: 2000,
        costBasis: 2000,
        dayGainLoss: 0,
        dayGainLossPercent: 0,
        unrealizedGainLoss: 0,
        unrealizedGainLossPercent: 0,
        thirtyDayChangePercent: 4.8,
        watchOnly: false,
        alert: false,
        reason: 'No active alert.',
      }],
      portfolio: [{
        id: 1,
        symbol: 'AAPL',
        companyName: 'Apple Inc.',
        quantity: 10,
        averageCost: 200,
        watchOnly: false,
      }],
      retirement: {
        investingStartDate: '2024-01-01',
        desiredMonthlyIncome: 2000,
        customReturnRate: 12,
        monthlySavings: 4000,
        otherSavings: 1,
        yearlyInflationRate: 3,
        safeWithdrawalRate: 4,
      },
    });
    await seedRememberedLogin(page);
    await gotoLoggedInDashboard(page);

    const retirementBoard = page.getByLabel('Retirement planner');
    const summary = retirementBoard.locator('.current-assets-card');
    await expect(summary).toContainText('Portfolio Summary');
    await expect(summary).toContainText('$2K');
    await expect(summary).toContainText('Holdings:');
    await expect(summary).toContainText('1');
    await expect(summary).toContainText('Initial Deposit:');
    await expect(summary).toContainText('$1');
    await expect(summary).toContainText('Total Invested:');
    await expect(summary).toContainText('Total P&L: $0');
    await expect(summary).toContainText('Total P&L %: 0.0%');
    await expect(summary).toContainText('Annualized Return%: 0.0%');
    await expect(summary).toContainText('Return Since:');
    await expect(summary).toContainText('2024-01-01');
    await expect(summary.locator('.subtext-item.app-tooltip')).toHaveCount(7);
    await expect(summary.locator('.subtext-item.app-tooltip').filter({ hasText: 'Initial Deposit:' }))
      .toHaveAttribute('data-tooltip', /retirement configuration/);
    await expect(summary.locator('.subtext-item.app-tooltip').filter({ hasText: 'Total Invested:' }))
      .toHaveAttribute('data-tooltip', /cost basis/);
    await expect(summary.locator('.subtext-item.app-tooltip').filter({ hasText: 'Annualized Return%:' }))
      .toHaveAttribute('data-tooltip', /total invested/);

    const targetFund = retirementBoard.locator('.target-fund-card');
    await expect(targetFund).toContainText('Target Retirement Fund');
    await expect(targetFund).toContainText('$600K');
    await expect(targetFund).toContainText('Today, using 4% SWR for $2K/mo');
    await expect(targetFund).toContainText('Realistic (10%):');
    await expect(targetFund).toContainText('Actual:');
    await expect(targetFund).toContainText('Custom (12%):');

    const config = retirementBoard.locator('.config-metric-card');
    await expect(config).toContainText('Retirement Configuration');
    await expect(config).toContainText('Start Date');
    await expect(config).toContainText('2024-01-01');
    await expect(config).toContainText('Initial Deposit');
    await expect(config).toContainText('$1');
    await expect(config).toContainText('Monthly Add');
    await expect(config).toContainText('$4K');
    await expect(config).toContainText('Target Income');
    await expect(config).toContainText('$2K/mo');
    await expect(config).toContainText('Inflation');
    await expect(config).toContainText('3%/yr');
    await expect(config).toContainText('SWR');
    await expect(config).toContainText('4%');
    await expect(config).toContainText('Custom Return');
    await expect(config).toContainText('12%');
  });
});
