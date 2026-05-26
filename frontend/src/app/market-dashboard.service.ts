import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { DashboardResponse, IndicatorSnapshot, NotificationStatus, PortfolioHolding, PortfolioImportResponse, StockAlert, SymbolSearchResult, UserAccountResponse, UserDcaSettings, UserRetirementSettings } from './market-dashboard.models';

export interface TelegramSendResponse {
  sent: boolean;
  message: string;
  missingChatId: boolean;
}

export interface TelegramSettingsResponse {
  chatId: string;
}

@Injectable({ providedIn: 'root' })
export class MarketDashboardService {
  private readonly apiBaseUrl = this.resolveApiBaseUrl();
  readonly dcaReminderMaxLength = 800;
  title = 'OpenFIRE';
  themeMode: 'dark' | 'light' = 'dark';
  username = '';
  password = '';
  rememberLogin = true;
  isLoading = false;
  isLoggedIn = false;
  isSavingHolding = false;
  isImportingPortfolio = false;
  snackbarMessage = '';
  snackbarTone: 'neutral' | 'error' = 'neutral';
  loginDialogOpen = false;
  authDialogMode: 'login' | 'create' = 'login';
  addDialogOpen = false;
  symbolQuery = '';
  symbolSuggestions: SymbolSearchResult[] = [];
  selectedSymbol?: SymbolSearchResult;
  showSymbolDropdown = false;
  symbolMessage = 'Start typing and choose a stock from the dropdown.';
  editDialogOpen = false;
  editOriginalSymbol = '';
  editSymbolQuery = '';
  editSymbolSuggestions: SymbolSearchResult[] = [];
  selectedEditSymbol?: SymbolSearchResult;
  showEditSymbolDropdown = false;
  editSymbolMessage = 'Keep this ticker or choose a new stock from the dropdown.';
  deleteDialogOpen = false;
  deleteTargetSymbol = '';
  alertsDialogOpen = false;
  telegramDialogOpen = false;
  telegramChatId = '';
  isSavingTelegram = false;
  dcaDialogOpen = false;
  dcaSuggestionDialogOpen = false;
  isLoadingDca = false;
  isSavingDca = false;
  hasLoadedDcaSettings = false;
  telegramDcaEnabled = false;
  dcaReminderNote = '';
  draftTelegramDcaEnabled = false;
  draftDcaReminderNote = '';
  readonly dcaSuggestionCards: ReadonlyArray<{ title: string; message: string }> = [
    {
      title: 'Stay Consistent',
      message: 'Follow your plan with consistency: invest the same amount on your scheduled DCA date every month, regardless of market headlines or short-term volatility. Your edge is discipline, not perfect timing. Review your cash buffer and risk level monthly, then keep executing your plan without emotional changes.',
    },
    {
      title: 'Balanced Allocation',
      message: 'Moderate baseline allocation idea: Stocks 60%, Bonds 35%, Cash 5%. Use this as a starting point, then adjust for your risk tolerance and timeline. Rebalance every 6-12 months, or when any major bucket drifts by more than 5 percentage points, so your portfolio stays aligned with your long-term strategy.',
    },
    {
      title: 'Diversify Core Holdings',
      message: 'Diversified core reminder: keep a broad stock-and-bond base (for example, 60/40 globally diversified), then limit concentrated sector bets. If you add tactical positions, cap total tactical exposure and avoid letting a single theme dominate your portfolio. Diversification helps reduce single-sector shock risk over time.',
    },
    {
      title: 'Use Category Caps',
      message: 'Category risk-cap framework: Tech up to 25%, Real Estate 10-15%, Energy 5-10%, Crypto up to 5%, with the remainder in diversified core holdings. If a category exceeds its cap after a rally, pause new buys there and direct DCA contributions to underweight categories to rebalance gradually and tax-efficiently.',
    },
    {
      title: 'Keep Dream Motivation',
      message: 'Dream-focused DCA note: today\'s contribution is not just a trade, it is a purchase of future optionality and freedom. Before you skip or delay, ask whether this decision helps your long-term plan. Small, repeated actions compounded over years are what turn financial goals into outcomes.',
    },
    {
      title: 'Automate and Review',
      message: 'Discipline over prediction: automate your DCA contributions, keep contribution amounts realistic, and avoid reacting to every macro signal. Use a monthly review checklist (allocation, risk concentration, cash runway, and upcoming expenses), then make only deliberate changes that support your long-term objective.',
    },
  ];
  retirementSettingsOpen = false;
  isLoadingRetirement = false;
  hasLoadedRetirementSettings = false;
  investingStartDate = '';
  desiredMonthlyIncome = 5000;
  customReturnRate = 12;
  yearlyInflationRate = 3;
  safeWithdrawalRate = 4;
  monthlySavings = 500;
  otherSavings = 10000;
  draftInvestingStartDate = '';
  draftDesiredMonthlyIncome = 5000;
  draftCustomReturnRate = 12;
  draftYearlyInflationRate = 3;
  draftSafeWithdrawalRate = 4;
  draftMonthlySavings = 500;
  draftOtherSavings = 10000;
  isSavingRetirement = false;
  editForm: PortfolioHolding = {
    symbol: '',
    companyName: '',
    quantity: 0,
    averageCost: 0,
    watchOnly: false,
  };
  holdingForm: PortfolioHolding = {
    symbol: '',
    companyName: '',
    quantity: 0,
    averageCost: 0,
    watchOnly: false,
  };
  dashboard: DashboardResponse = {
    asOf: new Date().toISOString(),
    dailyReport: '-',
    notification: {
      enabled: false,
      configured: false,
      provider: 'Notifications',
    },
    indicators: [],
    stocks: [],
    portfolio: [],
  };

  constructor(private readonly http: HttpClient) {}

  get indicators(): IndicatorSnapshot[] {
    return this.dashboard.indicators;
  }

  get stocks(): StockAlert[] {
    return this.dashboard.stocks;
  }

  get portfolio(): PortfolioHolding[] {
    return this.dashboard.portfolio;
  }

  get alertCount(): number {
    return this.stocks.filter((stock) => stock.alert).length;
  }

  get themeToggleLabel(): string {
    return this.themeMode === 'dark' ? 'Light mode' : 'Dark mode';
  }

  get telegramBotUsername(): string {
    const [, username] = this.dashboard.notification.provider.split('@');
    return username || 'sma3141_bot';
  }

  get canSaveHolding(): boolean {
    return Boolean(this.selectedSymbol)
      && (this.holdingForm.watchOnly || this.holdingForm.quantity > 0)
      && (this.holdingForm.watchOnly || this.holdingForm.averageCost >= 0)
      && !this.isSavingHolding;
  }

  get canSaveEdit(): boolean {
    const symbolUnchanged = this.editForm.symbol.toUpperCase() === this.editOriginalSymbol.toUpperCase();
    return this.editDialogOpen
      && (symbolUnchanged || Boolean(this.selectedEditSymbol))
      && (this.editForm.watchOnly || this.editForm.quantity > 0)
      && (this.editForm.watchOnly || this.editForm.averageCost >= 0)
      && !this.isSavingHolding;
  }

  get authDialogTitle(): string {
    return this.authDialogMode === 'create' ? 'Create User' : 'Login';
  }

  get authSubmitLabel(): string {
    if (this.isLoading) {
      return this.authDialogMode === 'create' ? 'Creating' : 'Logging in';
    }
    return this.authDialogMode === 'create' ? 'Create user' : 'Login';
  }

  get authCredentialsValid(): boolean {
    return this.username.trim().length >= 3 && this.password.length >= 8;
  }

  get dcaSuggestionSamples(): string[] {
    return this.dcaSuggestionCards.map((card) => card.message);
  }

  get canSubmitAuth(): boolean {
    return this.authCredentialsValid && !this.isLoading;
  }

  setHoldingWatchOnly(watchOnly: boolean): void {
    this.holdingForm.watchOnly = watchOnly;
    if (watchOnly) {
      this.holdingForm.quantity = 0;
      this.holdingForm.averageCost = 0;
    }
  }

  setEditWatchOnly(watchOnly: boolean): void {
    this.editForm.watchOnly = watchOnly;
    if (watchOnly) {
      this.editForm.quantity = 0;
      this.editForm.averageCost = 0;
    }
  }

  createUser(username: string, password: string): Observable<UserAccountResponse> {
    return this.http.post<UserAccountResponse>(`${this.apiBaseUrl}/users`, { username, password });
  }

  fetchDashboard(username: string, password: string): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(`${this.apiBaseUrl}/dashboard`, {
      headers: this.basicAuth(username, password),
    });
  }

  fetchIndicators(username: string, password: string): Observable<IndicatorSnapshot[]> {
    return this.http.get<IndicatorSnapshot[]>(`${this.apiBaseUrl}/indicators`, {
      headers: this.basicAuth(username, password),
    });
  }

  fetchStocks(username: string, password: string): Observable<StockAlert[]> {
    return this.http.get<StockAlert[]>(`${this.apiBaseUrl}/stocks`, {
      headers: this.basicAuth(username, password),
    });
  }

  fetchPortfolio(username: string, password: string): Observable<PortfolioHolding[]> {
    return this.http.get<PortfolioHolding[]>(`${this.apiBaseUrl}/portfolio`, {
      headers: this.basicAuth(username, password),
    });
  }

  notificationStatus(username: string, password: string): Observable<NotificationStatus> {
    return this.http.get<NotificationStatus>(`${this.apiBaseUrl}/notifications/status`, {
      headers: this.basicAuth(username, password),
    });
  }

  sendTelegram(username: string, password: string, message: string): Observable<TelegramSendResponse> {
    return this.http.post<TelegramSendResponse>(
      `${this.apiBaseUrl}/notifications/telegram`,
      { message },
      { headers: this.basicAuth(username, password) },
    );
  }

  telegramSettings(username: string, password: string): Observable<TelegramSettingsResponse> {
    return this.http.get<TelegramSettingsResponse>(`${this.apiBaseUrl}/users/me/telegram`, {
      headers: this.basicAuth(username, password),
    });
  }

  saveTelegramSettings(username: string, password: string, chatId: string): Observable<TelegramSettingsResponse> {
    return this.http.put<TelegramSettingsResponse>(
      `${this.apiBaseUrl}/users/me/telegram`,
      { chatId },
      { headers: this.basicAuth(username, password) },
    );
  }

  saveHolding(
    username: string,
    password: string,
    holding: PortfolioHolding,
  ): Observable<PortfolioHolding> {
    const normalizedHolding = this.normalizedHolding(holding);
    return this.http.post<PortfolioHolding>(
      `${this.apiBaseUrl}/portfolio`,
      normalizedHolding,
      { headers: this.basicAuth(username, password) },
    );
  }

  deleteHolding(username: string, password: string, symbol: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBaseUrl}/portfolio/${encodeURIComponent(symbol)}`, {
      headers: this.basicAuth(username, password),
    });
  }

  exportPortfolio(username: string, password: string): Observable<Blob> {
    return this.http.get(`${this.apiBaseUrl}/portfolio/export`, {
      headers: this.basicAuth(username, password),
      responseType: 'blob',
    });
  }

  importPortfolio(username: string, password: string, csv: string): Observable<PortfolioImportResponse> {
    return this.http.post<PortfolioImportResponse>(
      `${this.apiBaseUrl}/portfolio/import`,
      csv,
      {
        headers: this.basicAuth(username, password).set('Content-Type', 'text/csv'),
      },
    );
  }

  searchSymbols(username: string, password: string, keywords: string): Observable<SymbolSearchResult[]> {
    return this.http.get<SymbolSearchResult[]>(`${this.apiBaseUrl}/symbols/search`, {
      headers: this.basicAuth(username, password),
      params: { keywords },
    });
  }

  retirementSettings(username: string, password: string): Observable<UserRetirementSettings> {
    return this.http.get<UserRetirementSettings>(`${this.apiBaseUrl}/users/me/retirement`, {
      headers: this.basicAuth(username, password),
    });
  }

  dcaSettings(username: string, password: string): Observable<UserDcaSettings> {
    return this.http.get<UserDcaSettings>(`${this.apiBaseUrl}/users/me/dca`, {
      headers: this.basicAuth(username, password),
    });
  }

  saveRetirementSettings(username: string, password: string, settings: UserRetirementSettings): Observable<UserRetirementSettings> {
    return this.http.put<UserRetirementSettings>(
      `${this.apiBaseUrl}/users/me/retirement`,
      settings,
      { headers: this.basicAuth(username, password) },
    );
  }

  saveDcaSettings(username: string, password: string, settings: UserDcaSettings): Observable<UserDcaSettings> {
    return this.http.put<UserDcaSettings>(
      `${this.apiBaseUrl}/users/me/dca`,
      settings,
      { headers: this.basicAuth(username, password) },
    );
  }

  private basicAuth(username: string, password: string): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    });
  }

  private normalizedHolding(holding: PortfolioHolding): PortfolioHolding {
    return holding.watchOnly
      ? { ...holding, quantity: 0, averageCost: 0 }
      : holding;
  }

  private resolveApiBaseUrl(): string {
    const location = globalThis.location;
    if (location?.hostname === 'localhost' && location.port === '4200') {
      return 'http://localhost:8080/api';
    }

    if (location?.hostname === '127.0.0.1' && location.port === '4200') {
      return 'http://127.0.0.1:8080/api';
    }

    return '/api';
  }
}
