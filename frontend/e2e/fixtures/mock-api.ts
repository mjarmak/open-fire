import { expect, Page } from '@playwright/test';
import type {
  IndicatorSnapshot,
  NotificationStatus,
  PortfolioHolding,
  StockAlert,
  SymbolSearchResult,
  UserDcaSettings,
  UserRetirementSettings,
} from '../../src/app/market-dashboard.models';

export const DEFAULT_USERNAME = 'demoUser';
export const DEFAULT_PASSWORD = 'demoPass123';

type UserMap = Record<string, string>;

type MockApiState = {
  users: UserMap;
  indicators: IndicatorSnapshot[];
  stocks: StockAlert[];
  portfolio: PortfolioHolding[];
  notification: NotificationStatus;
  retirement: UserRetirementSettings;
  dca: UserDcaSettings;
  telegramChatId: string;
  symbolCatalog: SymbolSearchResult[];
};

export type MockApiController = {
  state: MockApiState;
  calls: Record<string, number>;
};

const defaultIndicators: IndicatorSnapshot[] = [
  {
    id: 'vix',
    name: 'Fear Index / VIX',
    category: 'VOLATILITY',
    value: 15.32,
    unit: 'index points',
    change: -0.4,
    status: 'fear',
    source: 'Mock',
    lastUpdated: new Date().toISOString(),
    description: 'Volatility benchmark for broad market stress.',
  },
  {
    id: 'credit',
    name: 'Credit Market',
    category: 'CREDIT',
    value: 0.74,
    unit: 'spread %',
    change: 0.01,
    status: 'watch',
    source: 'Mock',
    lastUpdated: new Date().toISOString(),
    description: 'Tracks corporate bond spread pressure.',
  },
];

const defaultPortfolio: PortfolioHolding[] = [
  { symbol: 'AAPL', companyName: 'Apple Inc.', quantity: 12, averageCost: 170, watchOnly: false },
  { symbol: 'MSFT', companyName: 'Microsoft Corp.', quantity: 8, averageCost: 320, watchOnly: false },
  { symbol: 'TSLA', companyName: 'Tesla Inc.', quantity: 0, averageCost: 0, watchOnly: true },
];

const defaultStocks: StockAlert[] = [
  {
    symbol: 'AAPL',
    companyName: 'Apple Inc.',
    positionType: 'Tech',
    quantity: 12,
    averageCost: 170,
    latestPrice: 198.2,
    marketCap: 2_900_000_000_000,
    peRatio: 29.1,
    beta: 1.19,
    realizedVolatilityPercent: 22.4,
    drawdownPercent: 8.6,
    fearScore: 63,
    marketValue: 2_378.4,
    costBasis: 2_040,
    dayGainLoss: 18.2,
    dayGainLossPercent: 0.77,
    unrealizedGainLoss: 338.4,
    unrealizedGainLossPercent: 16.59,
    thirtyDayChangePercent: 4.8,
    watchOnly: false,
    alert: false,
    reason: 'No active alert.',
  },
  {
    symbol: 'MSFT',
    companyName: 'Microsoft Corp.',
    positionType: 'Tech',
    quantity: 8,
    averageCost: 320,
    latestPrice: 424.5,
    marketCap: 3_100_000_000_000,
    peRatio: 35.2,
    beta: 1.02,
    realizedVolatilityPercent: 19.9,
    drawdownPercent: 6.2,
    fearScore: 69,
    marketValue: 3_396,
    costBasis: 2_560,
    dayGainLoss: -12.4,
    dayGainLossPercent: -0.36,
    unrealizedGainLoss: 836,
    unrealizedGainLossPercent: 32.66,
    thirtyDayChangePercent: 7.4,
    watchOnly: false,
    alert: true,
    reason: 'P/E and fear thresholds are elevated.',
  },
  {
    symbol: 'TSLA',
    companyName: 'Tesla Inc.',
    positionType: 'Auto',
    quantity: 0,
    averageCost: 0,
    latestPrice: 212.5,
    marketCap: 670_000_000_000,
    peRatio: 58.5,
    beta: 1.8,
    realizedVolatilityPercent: 44.1,
    drawdownPercent: 24.2,
    fearScore: 78,
    marketValue: null,
    costBasis: null,
    dayGainLoss: null,
    dayGainLossPercent: null,
    unrealizedGainLoss: null,
    unrealizedGainLossPercent: null,
    thirtyDayChangePercent: 21.3,
    watchOnly: true,
    alert: true,
    reason: 'Watch only: high volatility and momentum spike.',
  },
];

const defaultRetirement: UserRetirementSettings = {
  investingStartDate: '2024-11-03',
  desiredMonthlyIncome: 3000,
  customReturnRate: 12,
  monthlySavings: 6000,
  otherSavings: 2000,
  yearlyInflationRate: 2,
  safeWithdrawalRate: 4,
};

const defaultDca: UserDcaSettings = {
  telegramDcaEnabled: false,
  reminderNote: 'Follow the plan and keep buying consistently.',
};

const defaultSymbols: SymbolSearchResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', region: 'US', currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', region: 'US', currency: 'USD' },
  { symbol: 'TSLA', name: 'Tesla Inc.', region: 'US', currency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', region: 'US', currency: 'USD' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', region: 'US', currency: 'USD' },
];

function defaultState(): MockApiState {
  return {
    users: { [DEFAULT_USERNAME]: DEFAULT_PASSWORD, secondUser: DEFAULT_PASSWORD },
    indicators: structuredClone(defaultIndicators),
    stocks: structuredClone(defaultStocks),
    portfolio: structuredClone(defaultPortfolio),
    notification: {
      enabled: true,
      configured: true,
      provider: 'Telegram @sma3141_bot',
    },
    retirement: structuredClone(defaultRetirement),
    dca: structuredClone(defaultDca),
    telegramChatId: '1547812774',
    symbolCatalog: structuredClone(defaultSymbols),
  };
}

function decodeBasicAuth(authHeader: string | undefined): { username: string; password: string } | null {
  if (!authHeader?.startsWith('Basic ')) {
    return null;
  }
  try {
    const encoded = authHeader.slice(6).trim();
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0) {
      return null;
    }
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function authorized(state: MockApiState, authHeader: string | undefined): boolean {
  const creds = decodeBasicAuth(authHeader);
  if (!creds) {
    return false;
  }
  return state.users[creds.username] === creds.password;
}

function normalizeHolding(raw: PortfolioHolding): PortfolioHolding {
  return {
    symbol: raw.symbol.trim().toUpperCase(),
    companyName: raw.companyName?.trim() || raw.symbol.trim().toUpperCase(),
    quantity: Number(raw.quantity ?? 0),
    averageCost: Number(raw.averageCost ?? 0),
    watchOnly: Boolean(raw.watchOnly),
  };
}

function buildStockFromHolding(holding: PortfolioHolding): StockAlert {
  const latestPrice = holding.watchOnly ? 200 : Number((holding.averageCost * 1.07 || 180).toFixed(2));
  const marketValue = holding.watchOnly ? null : Number((latestPrice * holding.quantity).toFixed(2));
  const costBasis = holding.watchOnly ? null : Number((holding.averageCost * holding.quantity).toFixed(2));
  const unrealizedGainLoss = holding.watchOnly || marketValue === null || costBasis === null
    ? null
    : Number((marketValue - costBasis).toFixed(2));
  const unrealizedGainLossPercent = holding.watchOnly || !costBasis
    ? null
    : Number((((unrealizedGainLoss || 0) / costBasis) * 100).toFixed(2));

  return {
    symbol: holding.symbol,
    companyName: holding.companyName,
    positionType: 'Other',
    quantity: holding.quantity,
    averageCost: holding.averageCost,
    latestPrice,
    marketCap: 40_000_000_000,
    peRatio: 20.1,
    beta: 1.1,
    realizedVolatilityPercent: 23,
    drawdownPercent: 7,
    fearScore: 52,
    marketValue,
    costBasis,
    dayGainLoss: holding.watchOnly ? null : 6.5,
    dayGainLossPercent: holding.watchOnly ? null : 0.45,
    unrealizedGainLoss,
    unrealizedGainLossPercent,
    thirtyDayChangePercent: 5.4,
    watchOnly: holding.watchOnly,
    alert: false,
    reason: 'No active alert.',
  };
}

function parseCsv(csv: string): PortfolioHolding[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return [];
  }
  return lines.slice(1).map((line) => {
    const [symbol = '', companyName = '', quantity = '0', averageCost = '0', watchOnly = 'false'] = line.split(',');
    return normalizeHolding({
      symbol,
      companyName,
      quantity: Number(quantity),
      averageCost: Number(averageCost),
      watchOnly: watchOnly.trim().toLowerCase() === 'true',
    });
  });
}

function exportCsvRows(portfolio: PortfolioHolding[]): string {
  const header = 'symbol,companyName,quantity,averageCost,watchOnly';
  const rows = portfolio.map((holding) =>
    `${holding.symbol},${holding.companyName},${holding.quantity},${holding.averageCost},${holding.watchOnly}`,
  );
  return [header, ...rows].join('\n');
}

function increment(calls: Record<string, number>, key: string): void {
  calls[key] = (calls[key] || 0) + 1;
}

export async function registerMockApi(page: Page, initial?: Partial<MockApiState>): Promise<MockApiController> {
  const state: MockApiState = {
    ...defaultState(),
    ...initial,
    users: {
      ...defaultState().users,
      ...(initial?.users || {}),
    },
  };
  const calls: Record<string, number> = {};

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const authHeader = request.headers()['authorization'];
    const authRequired = !(method === 'POST' && path === '/users');
    increment(calls, `${method} ${path}`);

    if (authRequired && !authorized(state, authHeader)) {
      await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      return;
    }

    if (method === 'POST' && path === '/users') {
      const payload = JSON.parse(request.postData() || '{}') as { username?: string; password?: string };
      const username = String(payload.username || '').trim();
      const password = String(payload.password || '');
      if (!username || password.length < 8) {
        await route.fulfill({ status: 400, json: { message: 'Invalid credentials' } });
        return;
      }
      if (state.users[username]) {
        await route.fulfill({ status: 409, json: { message: 'User already exists' } });
        return;
      }
      state.users[username] = password;
      await route.fulfill({ status: 200, json: { username } });
      return;
    }

    if (method === 'GET' && path === '/indicators') {
      await route.fulfill({ status: 200, json: state.indicators });
      return;
    }
    if (method === 'GET' && path === '/stocks') {
      await route.fulfill({ status: 200, json: state.stocks });
      return;
    }
    if (method === 'GET' && path === '/portfolio') {
      await route.fulfill({ status: 200, json: state.portfolio });
      return;
    }
    if (method === 'GET' && path === '/notifications/status') {
      await route.fulfill({ status: 200, json: state.notification });
      return;
    }
    if (method === 'GET' && path === '/users/me/retirement') {
      await route.fulfill({ status: 200, json: state.retirement });
      return;
    }
    if (method === 'PUT' && path === '/users/me/retirement') {
      state.retirement = JSON.parse(request.postData() || '{}') as UserRetirementSettings;
      await route.fulfill({ status: 200, json: state.retirement });
      return;
    }
    if (method === 'GET' && path === '/users/me/dca') {
      await route.fulfill({ status: 200, json: state.dca });
      return;
    }
    if (method === 'PUT' && path === '/users/me/dca') {
      state.dca = JSON.parse(request.postData() || '{}') as UserDcaSettings;
      await route.fulfill({ status: 200, json: state.dca });
      return;
    }
    if (method === 'GET' && path === '/users/me/telegram') {
      await route.fulfill({ status: 200, json: { chatId: state.telegramChatId } });
      return;
    }
    if (method === 'PUT' && path === '/users/me/telegram') {
      const payload = JSON.parse(request.postData() || '{}') as { chatId?: string };
      state.telegramChatId = String(payload.chatId || '');
      await route.fulfill({ status: 200, json: { chatId: state.telegramChatId } });
      return;
    }
    if (method === 'POST' && path === '/notifications/telegram') {
      await route.fulfill({ status: 200, json: { sent: true, message: 'Telegram test sent.', missingChatId: false } });
      return;
    }
    if (method === 'GET' && path === '/symbols/search') {
      const query = (url.searchParams.get('keywords') || '').trim().toLowerCase();
      const results = state.symbolCatalog.filter((item) =>
        item.symbol.toLowerCase().includes(query) || item.name.toLowerCase().includes(query),
      );
      await route.fulfill({ status: 200, json: results.slice(0, 8) });
      return;
    }
    if (method === 'POST' && path === '/portfolio') {
      const payload = JSON.parse(request.postData() || '{}') as PortfolioHolding;
      const nextHolding = normalizeHolding(payload);
      const portfolioIndex = state.portfolio.findIndex((item) => item.symbol === nextHolding.symbol);
      if (portfolioIndex >= 0) {
        state.portfolio[portfolioIndex] = nextHolding;
      } else {
        state.portfolio.push(nextHolding);
      }

      const stockIndex = state.stocks.findIndex((item) => item.symbol === nextHolding.symbol);
      const mergedStock = {
        ...(stockIndex >= 0 ? state.stocks[stockIndex] : buildStockFromHolding(nextHolding)),
        ...buildStockFromHolding(nextHolding),
      };
      if (stockIndex >= 0) {
        state.stocks[stockIndex] = mergedStock;
      } else {
        state.stocks.push(mergedStock);
      }

      await route.fulfill({ status: 200, json: nextHolding });
      return;
    }
    if (method === 'DELETE' && path.startsWith('/portfolio/')) {
      const symbol = decodeURIComponent(path.replace('/portfolio/', '')).toUpperCase();
      state.portfolio = state.portfolio.filter((item) => item.symbol !== symbol);
      state.stocks = state.stocks.filter((item) => item.symbol !== symbol);
      await route.fulfill({ status: 200, json: {} });
      return;
    }
    if (method === 'GET' && path === '/portfolio/export') {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        body: exportCsvRows(state.portfolio),
      });
      return;
    }
    if (method === 'POST' && path === '/portfolio/import') {
      const csv = request.postData() || '';
      const imported = parseCsv(csv);
      for (const holding of imported) {
        const portfolioIndex = state.portfolio.findIndex((item) => item.symbol === holding.symbol);
        if (portfolioIndex >= 0) {
          state.portfolio[portfolioIndex] = holding;
        } else {
          state.portfolio.push(holding);
        }
        const stockIndex = state.stocks.findIndex((item) => item.symbol === holding.symbol);
        const enriched = {
          ...(stockIndex >= 0 ? state.stocks[stockIndex] : buildStockFromHolding(holding)),
          ...buildStockFromHolding(holding),
        };
        if (stockIndex >= 0) {
          state.stocks[stockIndex] = enriched;
        } else {
          state.stocks.push(enriched);
        }
      }

      await route.fulfill({ status: 200, json: { imported: imported.length, errors: [] } });
      return;
    }

    await route.fulfill({ status: 404, json: { message: `No mock route for ${method} ${path}` } });
  });

  return { state, calls };
}

export async function seedRememberedLogin(page: Page, username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD): Promise<void> {
  await page.addInitScript((auth) => {
    localStorage.setItem('sma_remember_login', 'true');
    localStorage.setItem('sma_username', auth.username);
    localStorage.setItem('sma_password', auth.password);
  }, { username, password });
}

export async function gotoLoggedInDashboard(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Portfolio' })).toBeVisible();
}
