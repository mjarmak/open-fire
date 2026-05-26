import { expect, test } from '@playwright/test';
import { registerMockApi, DEFAULT_PASSWORD } from '../fixtures/mock-api';

test.describe('Auth Section', () => {
  test.beforeEach(async ({ page }) => {
    await registerMockApi(page);
    await page.goto('/');
  });

  test('shows welcome page when user is not logged in', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create user' })).toBeVisible();
  });

  test('opens and closes login dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { name: 'Login' })).toBeHidden();
  });

  test('creates a user account from dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Create user' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create User' });
    await dialog.getByRole('textbox', { name: 'User' }).fill('newuser');
    await dialog.locator('input[name="password"]').fill(DEFAULT_PASSWORD);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  });

  test('logs in from dialog with remembered credentials', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click();
    const dialog = page.getByRole('dialog', { name: 'Login' });
    await dialog.getByRole('textbox', { name: 'User' }).fill('demoUser');
    await dialog.locator('input[name="password"]').fill(DEFAULT_PASSWORD);
    await dialog.getByRole('checkbox', { name: 'Remember username and password' }).check();
    await dialog.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
  });

  test('logs in, logs out, then logs in as a different user', async ({ page }) => {
    await page.getByRole('button', { name: 'Login' }).click();
    let dialog = page.getByRole('dialog', { name: 'Login' });
    await dialog.getByRole('textbox', { name: 'User' }).fill('demoUser');
    await dialog.locator('input[name="password"]').fill(DEFAULT_PASSWORD);
    await dialog.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to OpenFIRE' })).toBeVisible();

    await page.getByRole('button', { name: 'Login' }).click();
    dialog = page.getByRole('dialog', { name: 'Login' });
    await dialog.getByRole('textbox', { name: 'User' }).fill('secondUser');
    await dialog.locator('input[name="password"]').fill(DEFAULT_PASSWORD);
    await dialog.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();

    await expect.poll(() => page.evaluate(() => localStorage.getItem('sma_username'))).toBe('secondUser');
  });
});
