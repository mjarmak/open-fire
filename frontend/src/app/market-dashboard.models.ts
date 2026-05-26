export interface IndicatorSnapshot {
  id: string;
  name: string;
  category: string;
  value: number;
  unit: string;
  change: number;
  status: string;
  source: string;
  lastUpdated: string;
  description: string;
}

export interface StockAlert {
  symbol: string;
  companyName: string;
  positionType: string;
  quantity: number;
  averageCost: number;
  latestPrice: number | null;
  marketCap: number | null;
  peRatio: number | null;
  beta: number | null;
  realizedVolatilityPercent: number | null;
  drawdownPercent: number | null;
  fearScore: number | null;
  marketValue: number | null;
  costBasis: number | null;
  dayGainLoss: number | null;
  dayGainLossPercent: number | null;
  unrealizedGainLoss: number | null;
  unrealizedGainLossPercent: number | null;
  thirtyDayChangePercent: number | null;
  watchOnly: boolean;
  alert: boolean;
  reason: string;
}

export interface PortfolioHolding {
  symbol: string;
  companyName: string;
  quantity: number;
  averageCost: number;
  watchOnly: boolean;
}

export interface PortfolioImportResponse {
  imported: number;
  errors: string[];
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  region: string;
  currency: string;
}

export interface UserAccountResponse {
  username: string;
}

export interface NotificationStatus {
  enabled: boolean;
  configured: boolean;
  provider: string;
}

export interface DashboardResponse {
  asOf: string;
  indicators: IndicatorSnapshot[];
  stocks: StockAlert[];
  portfolio: PortfolioHolding[];
  dailyReport: string;
  notification: NotificationStatus;
}

export interface UserRetirementSettings {
  investingStartDate: string | null;
  desiredMonthlyIncome: number | null;
  customReturnRate: number | null;
  monthlySavings: number | null;
  otherSavings: number | null;
  yearlyInflationRate: number | null;
  safeWithdrawalRate: number | null;
}

export interface UserDcaSettings {
  telegramDcaEnabled: boolean;
  reminderNote: string;
}
