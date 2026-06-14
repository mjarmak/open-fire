import { ElementRef } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { StockAlert, SymbolSearchResult } from './market-dashboard.models';
import { MarketDashboardService } from './market-dashboard.service';

describe('AppComponent', () => {
  let marketDashboardService: jasmine.SpyObj<MarketDashboardService>;

  function stockLookupRisk(overrides: Partial<StockAlert> = {}): StockAlert {
    return {
      id: null,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      positionType: 'Technology',
      quantity: 0,
      averageCost: 0,
      latestPrice: 195.5,
      marketCap: 3_000_000_000_000,
      peRatio: 28,
      beta: 1.2,
      realizedVolatilityPercent: 18,
      drawdownPercent: 4,
      fearScore: 35,
      marketValue: null,
      costBasis: null,
      dayGainLoss: 2.34,
      dayGainLossPercent: 1.21,
      unrealizedGainLoss: null,
      unrealizedGainLossPercent: null,
      thirtyDayChangePercent: 7,
      watchOnly: true,
      alert: false,
      reason: 'No alert',
      ...overrides,
    };
  }

  beforeEach(async () => {
    localStorage.clear();
    marketDashboardService = jasmine.createSpyObj<MarketDashboardService>('MarketDashboardService', [
      'createUser',
      'fetchDashboard',
      'fetchIndicators',
      'fetchStocks',
      'fetchStockHistory',
      'fetchIndicatorHistory',
      'fetchPortfolio',
      'notificationStatus',
      'sendTelegram',
      'submitFeedback',
      'telegramSettings',
      'saveTelegramSettings',
      'saveHolding',
      'updateHolding',
      'deleteHolding',
      'exportPortfolio',
      'importPortfolio',
      'retirementSettings',
      'saveRetirementSettings',
      'dcaSettings',
      'saveDcaSettings',
      'testMarketApiToken',
      'searchSymbols',
      'ensureGlobalIndicatorChart',
      'getGlobalIndicatorChartRange',
      'setGlobalIndicatorChartRange',
      'globalIndicatorChartPoints',
      'isGlobalIndicatorChartLoading',
      'formatNotificationDays',
      'isDraftTelegramAlertDaySelected',
      'setDraftTelegramAlertDay',
      'isDraftDcaReminderDaySelected',
      'setDraftDcaReminderDay',
      'loadMarketApiTokenDraftsFromBrowser',
      'saveMarketApiTokenDraftsToBrowser',
      'draftMarketApiToken',
      'hasDraftMarketApiToken',
      'hasAnyDraftMarketApiToken',
      'setDraftMarketApiToken',
      'isMarketApiTokenVisible',
      'toggleMarketApiTokenVisibility',
      'clearMarketApiTokenVisibility',
      'setMarketApiTokenTestState',
      'clearMarketApiTokenTestStates',
      'isTestingMarketApiToken',
      'marketApiTokenTestSucceeded',
      'marketApiTokenTestFailed',
      'marketApiTokenTestMessage',
    ]);
    Object.assign(marketDashboardService, new MarketDashboardService({} as never));
    Object.defineProperties(marketDashboardService, {
      indicators: {
        get: () => marketDashboardService.dashboard.indicators,
      },
      stocks: {
        get: () => marketDashboardService.dashboard.stocks,
      },
      portfolio: {
        get: () => marketDashboardService.dashboard.portfolio,
      },
      alertCount: {
        get: () => marketDashboardService.dashboard.stocks.filter((stock) => stock.alert).length,
      },
    });
    marketDashboardService.fetchIndicators.and.returnValue(of([]));
    marketDashboardService.fetchStocks.and.returnValue(of([]));
    marketDashboardService.fetchStockHistory.and.returnValue(of({ id: 'AAPL', range: '1y', points: [] }));
    marketDashboardService.fetchIndicatorHistory.and.returnValue(of({ id: 'vix', range: '1y', points: [] }));
    marketDashboardService.fetchPortfolio.and.returnValue(of([]));
    marketDashboardService.notificationStatus.and.returnValue(of({
      enabled: false,
      configured: false,
      provider: 'Telegram',
    }));
    marketDashboardService.retirementSettings.and.returnValue(of({
      investingStartDate: null,
      desiredMonthlyIncome: null,
      customReturnRate: null,
      monthlySavings: null,
      otherSavings: null,
      yearlyInflationRate: null,
      safeWithdrawalRate: null,
    }));
    marketDashboardService.dcaSettings.and.returnValue(of({
      telegramDcaEnabled: false,
      reminderNote: '',
      reminderDays: ['WED', 'FRI'],
    }));
    marketDashboardService.testMarketApiToken.and.returnValue(of({
      provider: 'finnhub',
      success: true,
      message: 'Finnhub token works.',
    }));
    marketDashboardService.searchSymbols.and.returnValue(of([]));
    marketDashboardService.submitFeedback.and.returnValue(of({
      id: 1,
      telegramSent: true,
      message: 'Feedback sent. Thank you.',
    }));
    marketDashboardService.getGlobalIndicatorChartRange.and.returnValue('1y');
    marketDashboardService.globalIndicatorChartPoints.and.returnValue([]);
    marketDashboardService.isGlobalIndicatorChartLoading.and.returnValue(false);
    marketDashboardService.formatNotificationDays.and.callFake((days: string[]) => days.join(', '));
    marketDashboardService.isDraftTelegramAlertDaySelected.and.callFake((day: string) =>
      marketDashboardService.draftTelegramAlertDays.includes(day));
    marketDashboardService.setDraftTelegramAlertDay.and.callFake((day: string, selected: boolean) => {
      marketDashboardService.draftTelegramAlertDays = selected
        ? [...new Set([...marketDashboardService.draftTelegramAlertDays, day])]
        : marketDashboardService.draftTelegramAlertDays.filter((value) => value !== day);
    });
    marketDashboardService.isDraftDcaReminderDaySelected.and.callFake((day: string) =>
      marketDashboardService.draftDcaReminderDays.includes(day));
    marketDashboardService.setDraftDcaReminderDay.and.callFake((day: string, selected: boolean) => {
      marketDashboardService.draftDcaReminderDays = selected
        ? [...new Set([...marketDashboardService.draftDcaReminderDays, day])]
        : marketDashboardService.draftDcaReminderDays.filter((value) => value !== day);
    });
    marketDashboardService.loadMarketApiTokenDraftsFromBrowser.and.callFake(() => {
      marketDashboardService.draftMarketApiTokens = {};
    });
    marketDashboardService.saveMarketApiTokenDraftsToBrowser.and.stub();
    marketDashboardService.draftMarketApiToken.and.callFake((providerId: string) =>
      marketDashboardService.draftMarketApiTokens[providerId] ?? '');
    marketDashboardService.hasDraftMarketApiToken.and.callFake((providerId: string) =>
      (marketDashboardService.draftMarketApiTokens[providerId] ?? '').trim().length > 0);
    marketDashboardService.hasAnyDraftMarketApiToken.and.callFake(() =>
      marketDashboardService.marketApiProviders.some((provider) =>
        (marketDashboardService.draftMarketApiTokens[provider.id] ?? '').trim().length > 0));
    marketDashboardService.setDraftMarketApiToken.and.callFake((providerId: string, token: string) => {
      marketDashboardService.draftMarketApiTokens = {
        ...marketDashboardService.draftMarketApiTokens,
        [providerId]: token,
      };
    });
    marketDashboardService.isMarketApiTokenVisible.and.callFake((providerId: string) =>
      Boolean(marketDashboardService.marketApiTokenVisibleProviders[providerId]));
    marketDashboardService.toggleMarketApiTokenVisibility.and.callFake((providerId: string) => {
      marketDashboardService.marketApiTokenVisibleProviders = {
        ...marketDashboardService.marketApiTokenVisibleProviders,
        [providerId]: !marketDashboardService.marketApiTokenVisibleProviders[providerId],
      };
    });
    marketDashboardService.clearMarketApiTokenVisibility.and.callFake(() => {
      marketDashboardService.marketApiTokenVisibleProviders = {};
    });
    marketDashboardService.setMarketApiTokenTestState.and.callFake((providerId: string, status: 'idle' | 'testing' | 'success' | 'error', message = '') => {
      marketDashboardService.marketApiTokenTestStatuses = {
        ...marketDashboardService.marketApiTokenTestStatuses,
        [providerId]: status,
      };
      marketDashboardService.marketApiTokenTestMessages = {
        ...marketDashboardService.marketApiTokenTestMessages,
        [providerId]: message,
      };
    });
    marketDashboardService.clearMarketApiTokenTestStates.and.callFake(() => {
      marketDashboardService.marketApiTokenTestStatuses = {};
      marketDashboardService.marketApiTokenTestMessages = {};
    });
    marketDashboardService.isTestingMarketApiToken.and.callFake((providerId: string) =>
      marketDashboardService.marketApiTokenTestStatuses[providerId] === 'testing');
    marketDashboardService.marketApiTokenTestSucceeded.and.callFake((providerId: string) =>
      marketDashboardService.marketApiTokenTestStatuses[providerId] === 'success');
    marketDashboardService.marketApiTokenTestFailed.and.callFake((providerId: string) =>
      marketDashboardService.marketApiTokenTestStatuses[providerId] === 'error');
    marketDashboardService.marketApiTokenTestMessage.and.callFake((providerId: string) =>
      marketDashboardService.marketApiTokenTestMessages[providerId] ?? '');

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: MarketDashboardService, useValue: marketDashboardService },
        provideNoopAnimations(),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'OpenFIRE' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('OpenFIRE');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('OpenFIRE');
  });

  it('does not log back in from stale dashboard responses after logout', () => {
    const delayedIndicators$ = new Subject<[]>();
    marketDashboardService.fetchIndicators.and.returnValue(delayedIndicators$.asObservable());
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'user';
    app.password = 'password123';

    app.refreshDashboard(true);
    app.logout();

    delayedIndicators$.next([]);
    delayedIndicators$.complete();

    expect(app.isLoggedIn).toBeFalse();
    expect(app.isLoading).toBeFalse();
  });

  it('logout clears stored username/password but keeps remember-login preference', () => {
    localStorage.setItem('sma_username', 'demoUser');
    localStorage.setItem('sma_password', 'demoPass123');
    localStorage.setItem('sma_remember_login', 'true');

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';
    app.rememberLogin = true;

    app.logout();

    expect(localStorage.getItem('sma_username')).toBeNull();
    expect(localStorage.getItem('sma_password')).toBeNull();
    expect(localStorage.getItem('sma_remember_login')).toBe('true');
    expect(app.username).toBe('');
    expect(app.password).toBe('');
  });

  it('keeps the user logged in when only one dashboard request returns unauthorized', () => {
    marketDashboardService.fetchIndicators.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'user';
    app.password = 'password123';

    app.refreshDashboard(true);

    expect(app.isLoggedIn).toBeTrue();
    expect(app.loginDialogOpen).toBeFalse();
    expect(app.password).toBe('password123');
    expect(app.snackbarMessage).toContain('Some dashboard data could not load');
  });

  it('opens login and clears the entered password when every dashboard request returns unauthorized', () => {
    const unauthorized = throwError(() => new HttpErrorResponse({ status: 401 }));
    marketDashboardService.fetchIndicators.and.returnValue(unauthorized);
    marketDashboardService.fetchStocks.and.returnValue(unauthorized);
    marketDashboardService.fetchPortfolio.and.returnValue(unauthorized);
    marketDashboardService.notificationStatus.and.returnValue(unauthorized);
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'user';
    app.password = 'password123';

    app.refreshDashboard(true);

    expect(app.isLoggedIn).toBeFalse();
    expect(app.loginDialogOpen).toBeTrue();
    expect(app.password).toBe('');
    expect(app.snackbarMessage).toContain('Login failed');
  });

  it('keeps add-position selection valid when a prior search timer is pending', fakeAsync(() => {
    const aapl: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
    };
    marketDashboardService.searchSymbols.and.returnValue(of([aapl]));

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'user';
    app.password = 'password123';
    app.holdingForm = { id: null, symbol: '', companyName: '', quantity: 1, averageCost: 10, watchOnly: false };

    app.symbolQuery = 'app';
    app.searchSymbols();
    app.chooseSymbol(aapl);

    tick(1000);

    expect(marketDashboardService.searchSymbols).not.toHaveBeenCalled();
    expect(app.holdingForm.symbol).toBe('AAPL');
    expect(app.canSaveHolding).toBeTrue();
  }));

  it('resets add-position form state whenever the dialog opens', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.holdingForm = { id: null, symbol: 'TSLA', companyName: 'Tesla', quantity: 0, averageCost: 0, watchOnly: true };
    app.selectedSymbol = { symbol: 'TSLA', name: 'Tesla', region: 'US', currency: 'USD' };
    app.symbolQuery = 'TSLA';
    app.symbolSuggestions = [{ symbol: 'TSLA', name: 'Tesla', region: 'US', currency: 'USD' }];
    app.showSymbolDropdown = true;

    app.openAddPosition();

    expect(app.addDialogOpen).toBeTrue();
    expect(app.holdingForm.watchOnly).toBeFalse();
    expect(app.holdingForm.symbol).toBe('');
    expect(app.holdingForm.companyName).toBe('');
    expect(app.selectedSymbol).toBeUndefined();
    expect(app.symbolQuery).toBe('');
    expect(app.showSymbolDropdown).toBeFalse();
  });

  it('adds a saved position to the local dashboard without refreshing the full dashboard', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const refreshSpy = spyOn(app, 'refreshDashboard');
    const savedHolding = {
      id: 42,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      quantity: 2,
      averageCost: 80,
      watchOnly: false,
    };
    marketDashboardService.saveHolding.and.returnValue(of(savedHolding));

    app.username = 'user';
    app.password = 'password123';
    app.selectedSymbol = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
      indicators: stockLookupRisk({
        latestPrice: 100,
        dayGainLoss: 3,
        dayGainLossPercent: 3.1,
        quantity: 1,
        watchOnly: true,
      }),
    };
    app.holdingForm = { ...savedHolding, id: null };

    app.saveHolding();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(app.dashboard.portfolio).toEqual([savedHolding]);
    expect(app.dashboard.stocks.length).toBe(1);
    expect(app.dashboard.stocks[0]).toEqual(jasmine.objectContaining({
      id: 42,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      quantity: 2,
      averageCost: 80,
      latestPrice: 100,
      marketValue: 200,
      costBasis: 160,
      dayGainLoss: 6,
      dayGainLossPercent: 3.1,
      unrealizedGainLoss: 40,
      unrealizedGainLossPercent: 25,
      watchOnly: false,
    }));
    expect(app.addDialogOpen).toBeFalse();
  });

  it('updates an edited position locally without refreshing the full dashboard', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const refreshSpy = spyOn(app, 'refreshDashboard');
    const existingStock = stockLookupRisk({
      id: 7,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      quantity: 4,
      averageCost: 20,
      latestPrice: 30,
      marketValue: 120,
      costBasis: 80,
      dayGainLoss: 8,
      dayGainLossPercent: 7.1,
      unrealizedGainLoss: 40,
      unrealizedGainLossPercent: 50,
      watchOnly: false,
    });
    const savedHolding = {
      id: 7,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      quantity: 6,
      averageCost: 25,
      watchOnly: false,
    };
    marketDashboardService.updateHolding.and.returnValue(of(savedHolding));
    app.dashboard = {
      ...app.dashboard,
      portfolio: [{ id: 7, symbol: 'MSFT', companyName: 'Microsoft', quantity: 4, averageCost: 20, watchOnly: false }],
      stocks: [existingStock],
    };
    app.username = 'user';
    app.password = 'password123';
    app.editDialogOpen = true;
    app.editOriginalId = 7;
    app.editOriginalSymbol = 'MSFT';
    app.editForm = savedHolding;

    app.saveEditedPosition();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(app.dashboard.portfolio).toEqual([savedHolding]);
    expect(app.dashboard.stocks.length).toBe(1);
    expect(app.dashboard.stocks[0]).toEqual(jasmine.objectContaining({
      id: 7,
      symbol: 'MSFT',
      quantity: 6,
      averageCost: 25,
      latestPrice: 30,
      marketValue: 180,
      costBasis: 150,
      dayGainLoss: 12,
      dayGainLossPercent: 7.1,
      unrealizedGainLoss: 30,
      unrealizedGainLossPercent: 20,
      watchOnly: false,
    }));
    expect(app.editDialogOpen).toBeFalse();
  });

  it('deletes a position locally without refreshing the full dashboard', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const refreshSpy = spyOn(app, 'refreshDashboard');
    marketDashboardService.deleteHolding.and.returnValue(of(void 0));
    app.dashboard = {
      ...app.dashboard,
      portfolio: [
        { id: 1, symbol: 'AAPL', companyName: 'Apple Inc.', quantity: 2, averageCost: 80, watchOnly: false },
        { id: 2, symbol: 'MSFT', companyName: 'Microsoft', quantity: 3, averageCost: 100, watchOnly: false },
      ],
      stocks: [
        stockLookupRisk({ id: 1, symbol: 'AAPL', companyName: 'Apple Inc.' }),
        stockLookupRisk({ id: 2, symbol: 'MSFT', companyName: 'Microsoft' }),
      ],
    };
    app.username = 'user';
    app.password = 'password123';

    app.deleteHolding(1, 'AAPL');

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(app.dashboard.portfolio.map((holding) => holding.symbol)).toEqual(['MSFT']);
    expect(app.dashboard.stocks.map((stock) => stock.symbol)).toEqual(['MSFT']);
    expect(app.snackbarMessage).toContain('AAPL removed');
  });

  it('focuses and selects the stock lookup input when the search dialog opens', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;
    app.username = 'user';
    app.password = 'password123';
    app.marketDashboardService.stockLookupQuery = 'A';

    app.searchHeaderStock();
    fixture.detectChanges();
    tick();

    const input = fixture.nativeElement.querySelector('#stock-lookup-query') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(0);
    expect(input?.selectionEnd).toBe(input?.value.length);
  }));

  it('does not refocus the stock lookup input after results render', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
    };
    app.isLoggedIn = true;
    app.username = 'user';
    app.password = 'password123';
    app.marketDashboardService.stockLookupQuery = 'A';

    app.searchHeaderStock();
    fixture.detectChanges();
    tick();

    const input = fixture.nativeElement.querySelector('#stock-lookup-query') as HTMLInputElement | null;
    const closeButton = fixture.nativeElement.querySelector('.stock-lookup-dialog .icon-action') as HTMLButtonElement | null;
    expect(input).not.toBeNull();
    expect(closeButton).not.toBeNull();

    closeButton?.focus();
    expect(document.activeElement).toBe(closeButton);

    app.marketDashboardService.stockLookupSuggestions = [result];
    app.marketDashboardService.stockLookupRisks = {};
    fixture.detectChanges();
    (app as unknown as { stockLookupQueryInput: ElementRef<HTMLInputElement> | undefined }).stockLookupQueryInput = new ElementRef(input!);
    tick();

    expect(document.activeElement).toBe(closeButton);
  }));

  it('clears stock lookup results immediately when the query is edited from the keyboard', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
    };
    app.isLoggedIn = true;
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupQuery = 'AAPL';
    app.marketDashboardService.stockLookupSuggestions = [result];
    app.marketDashboardService.stockLookupRisks = { AAPL: stockLookupRisk() };
    app.marketDashboardService.stockLookupResult = stockLookupRisk();
    app.marketDashboardService.selectedStockLookup = result;
    app.marketDashboardService.stockLookupMessage = 'Choose a result to add it to your portfolio.';

    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#stock-lookup-query') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', bubbles: true }));
    fixture.detectChanges();

    expect(app.marketDashboardService.stockLookupSuggestions).toEqual([]);
    expect(app.marketDashboardService.stockLookupRisks).toEqual({});
    expect(app.marketDashboardService.stockLookupResult).toBeUndefined();
    expect(app.marketDashboardService.selectedStockLookup).toBeUndefined();
    expect(app.marketDashboardService.stockLookupMessage).toBe('Searching...');
    expect(fixture.nativeElement.querySelector('.stock-lookup-result-row')).toBeNull();
  }));

  it('searches stock lookup without requesting preview indicators', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
      indicators: stockLookupRisk(),
    };
    marketDashboardService.searchSymbols.and.returnValue(of([result]));
    app.isLoggedIn = true;
    app.username = 'user';
    app.password = 'password123';
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupQuery = 'app';

    app.runStockLookupSearch();
    fixture.detectChanges();

    expect(marketDashboardService.searchSymbols).toHaveBeenCalledOnceWith('user', 'password123', 'app', false, true);
    expect(app.marketDashboardService.stockLookupSuggestions).toEqual([result]);
    expect(app.marketDashboardService.stockLookupRisks).toEqual({});
    expect(app.marketDashboardService.stockLookupMessage).toBe('Choose a result to add it to your portfolio.');
    const metrics = fixture.nativeElement.querySelector('.stock-lookup-result-row .ticker-metrics') as HTMLElement | null;
    expect(metrics).not.toBeNull();
    expect(metrics?.textContent).toContain('Price');
    expect(metrics?.textContent).toContain('$195.50');
    expect(metrics?.textContent).toContain('Market Cap');
    expect(metrics?.textContent).toContain('$3T');
    expect(metrics?.textContent).not.toContain('Today');
    expect(metrics?.textContent).not.toContain('1.21%');
    expect(metrics?.textContent).not.toContain('$2.34');
    expect(fixture.nativeElement.querySelector('.stock-lookup-result-row .position-title-inline-metric')).toBeNull();
  });

  it('keeps stock lookup results when a non-editing key is pressed', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
    };
    app.isLoggedIn = true;
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupQuery = 'AAPL';
    app.marketDashboardService.stockLookupSuggestions = [result];
    app.marketDashboardService.stockLookupRisks = { AAPL: stockLookupRisk() };

    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#stock-lookup-query') as HTMLInputElement | null;
    input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    expect(app.marketDashboardService.stockLookupSuggestions).toEqual([result]);
    expect(Object.keys(app.marketDashboardService.stockLookupRisks)).toEqual(['AAPL']);
    expect(fixture.nativeElement.querySelector('.stock-lookup-result-row')).not.toBeNull();
  }));

  it('keeps the stock lookup dialog open when its backdrop is clicked', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;

    app.searchHeaderStock();
    fixture.detectChanges();
    tick();

    const backdrop = fixture.nativeElement.querySelector('.stock-lookup-backdrop') as HTMLElement | null;
    expect(backdrop).not.toBeNull();

    backdrop?.click();
    fixture.detectChanges();

    expect(app.marketDashboardService.stockLookupDialogOpen).toBeTrue();
  }));

  it('opens the add-position dialog from a stock lookup result add button', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
    };
    app.isLoggedIn = true;
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupSuggestions = [result];
    app.marketDashboardService.stockLookupRisks = {};

    fixture.detectChanges();

    const addButton = fixture.nativeElement.querySelector('.stock-lookup-add-button') as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();

    addButton?.click();

    expect(app.marketDashboardService.stockLookupDialogOpen).toBeFalse();
    expect(app.addDialogOpen).toBeTrue();
    expect(app.selectedSymbol).toEqual(result);
    expect(app.holdingForm.symbol).toBe('AAPL');
    expect(app.holdingForm.companyName).toBe('Apple Inc.');
    expect(app.symbolQuery).toBe('AAPL');
  });

  it('only shows price details in stock lookup result rows', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
      indicators: stockLookupRisk({
        dayGainLoss: -3.2,
        dayGainLossPercent: -1.25,
      }),
    };
    app.isLoggedIn = true;
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupSuggestions = [result];
    app.marketDashboardService.stockLookupRisks = {
      AAPL: stockLookupRisk({
        dayGainLoss: -3.2,
        dayGainLossPercent: -1.25,
      }),
    };

    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.stock-lookup-result-row') as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.querySelector('.position-title-inline-metric')).toBeNull();
    expect(row?.querySelector('.ticker-metrics')).not.toBeNull();
    expect(row?.textContent).toContain('Price');
    expect(row?.textContent).toContain('Market Cap');
    expect(row?.textContent).not.toContain('Today');
    expect(row?.textContent).not.toContain('Fear');
    expect(row?.textContent).not.toContain('30D');
    expect(row?.textContent).not.toContain('P/E');
    expect(row?.textContent).not.toContain('Vol');
    expect(row?.textContent).not.toContain('DD');
  });

  it('does not show a today change badge for lookup results without indicators', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;
    app.marketDashboardService.stockLookupDialogOpen = true;
    app.marketDashboardService.stockLookupSuggestions = [{
      symbol: 'MSFT',
      name: 'Microsoft',
      region: 'US',
      currency: 'USD',
    }];
    app.marketDashboardService.stockLookupRisks = {};

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.stock-lookup-result-row .position-title-inline-metric')).toBeNull();
    expect(fixture.nativeElement.querySelector('.stock-lookup-result-row .ticker-metrics')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Could not load indicators.');
  });

  it('states when Telegram alerts and DCA reminders are sent in settings dialogs', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.marketDashboardService.telegramDialogOpen = true;
    app.marketDashboardService.dcaDialogOpen = true;

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Alert briefings are sent once daily at 21:00 UTC on the selected days.');
    expect(text).toContain('DCA reminders are sent at 14:00 UTC on their selected reminder days when enabled.');
    expect(text).toContain('DCA reminders are sent at 14:00 UTC on the selected days.');
  });

  it('opens API token settings from the top menu and saves browser token drafts', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;
    app.username = 'user';
    app.password = 'password123';

    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector('.top-menu-button') as HTMLButtonElement | null;
    menuButton?.click();
    fixture.detectChanges();

    const apiButton = Array.from(root.querySelectorAll<HTMLButtonElement>('.top-menu-action'))
      .find((button): button is HTMLButtonElement => button.textContent?.includes('API Tokens') ?? false);
    apiButton?.click();
    fixture.detectChanges();

    expect(marketDashboardService.loadMarketApiTokenDraftsFromBrowser).toHaveBeenCalled();
    expect(marketDashboardService.clearMarketApiTokenVisibility).toHaveBeenCalled();
    expect(app.marketDashboardService.apiTokenDialogOpen).toBeTrue();
    expect(root.textContent).toContain('We do not store your API tokens in our system');
    expect(root.textContent).toContain('Finnhub');
    expect(root.querySelector('a[href="https://finnhub.io/register"]')).not.toBeNull();
    expect(root.querySelector('input[type="checkbox"]')).toBeNull();

    const finnhubProvider = Array.from(root.querySelectorAll<HTMLElement>('.api-provider-item'))
      .find((item): item is HTMLElement => item.textContent?.includes('Finnhub') ?? false);
    expect(finnhubProvider?.querySelector<HTMLInputElement>('input[placeholder="Use developer token"]')?.type).toBe('password');
    const visibilityButton = finnhubProvider?.querySelector<HTMLButtonElement>('.api-token-visibility-button');
    expect(visibilityButton?.getAttribute('aria-pressed')).toBe('false');
    visibilityButton?.click();
    fixture.detectChanges();

    expect(marketDashboardService.toggleMarketApiTokenVisibility).toHaveBeenCalledWith('finnhub');
    expect(finnhubProvider?.querySelector<HTMLInputElement>('input[placeholder="Use developer token"]')?.type).toBe('text');
    expect(finnhubProvider?.querySelector<HTMLButtonElement>('.api-token-visibility-button')?.getAttribute('aria-pressed')).toBe('true');

    let downloadButton = root.querySelector<HTMLButtonElement>('.api-token-download-button');
    expect(downloadButton?.disabled).toBeTrue();
    expect(downloadButton?.classList.contains('button-loading')).toBeFalse();
    expect(downloadButton?.getAttribute('aria-busy')).toBeNull();

    let testButton = finnhubProvider?.querySelector<HTMLButtonElement>('.api-token-test-button');
    expect(testButton?.disabled).toBeTrue();
    expect(testButton?.classList.contains('button-loading')).toBeFalse();
    expect(testButton?.getAttribute('aria-busy')).toBeNull();

    app.marketDashboardService.draftMarketApiTokens = { finnhub: 'browser-only-token' };
    fixture.detectChanges();
    downloadButton = root.querySelector<HTMLButtonElement>('.api-token-download-button');
    expect(downloadButton?.disabled).toBeFalse();
    const downloadSpy = spyOn(app, 'downloadApiTokens');
    downloadButton?.click();
    expect(downloadSpy).toHaveBeenCalled();

    app.marketDashboardService.marketApiTokenTestStatuses = { finnhub: 'testing' };
    fixture.detectChanges();
    testButton = finnhubProvider?.querySelector<HTMLButtonElement>('.api-token-test-button');
    expect(testButton?.disabled).toBeTrue();
    expect(testButton?.classList.contains('button-loading')).toBeTrue();
    expect(testButton?.getAttribute('aria-busy')).toBe('true');

    app.marketDashboardService.marketApiTokenTestStatuses = {};
    fixture.detectChanges();
    testButton = finnhubProvider?.querySelector<HTMLButtonElement>('.api-token-test-button');
    expect(testButton?.disabled).toBeFalse();
    testButton?.click();
    fixture.detectChanges();

    expect(marketDashboardService.testMarketApiToken).toHaveBeenCalledOnceWith('user', 'password123', 'finnhub');
    expect(marketDashboardService.setMarketApiTokenTestState).toHaveBeenCalledWith('finnhub', 'testing', 'Testing token...');
    expect(root.textContent).toContain('Finnhub token works.');

    app.saveApiTokenSettings();

    expect(marketDashboardService.saveMarketApiTokenDraftsToBrowser).toHaveBeenCalled();
    expect(app.marketDashboardService.apiTokenDialogOpen).toBeFalse();
  });

  it('downloads non-empty API token drafts as JSON', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;
    app.marketDashboardService.draftMarketApiTokens = {
      finnhub: '  finnhub-token  ',
      twelvedata: '',
      eodhd: 'eodhd-token',
    };
    const createObjectUrlSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:openfire-api-tokens');
    const revokeObjectUrlSpy = spyOn(URL, 'revokeObjectURL').and.stub();
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click').and.stub();

    app.downloadApiTokens();

    expect(createObjectUrlSpy).toHaveBeenCalled();
    const blob = createObjectUrlSpy.calls.mostRecent().args[0] as Blob;
    const exported = JSON.parse(await blob.text()) as {
      exportedAt: string;
      tokens: Array<{ provider: string; name: string; token: string }>;
    };
    expect(exported.exportedAt).toEqual(jasmine.any(String));
    expect(exported.tokens).toEqual([
      { provider: 'finnhub', name: 'Finnhub', token: 'finnhub-token' },
      { provider: 'eodhd', name: 'EODHD', token: 'eodhd-token' },
    ]);
    const clickedLink = clickSpy.calls.mostRecent().object as HTMLAnchorElement;
    expect(clickedLink.download).toMatch(/^openfire-api-tokens-\d{4}-\d{2}-\d{2}\.json$/);
    expect(revokeObjectUrlSpy).toHaveBeenCalledOnceWith('blob:openfire-api-tokens');
    expect(app.snackbarMessage).toBe('2 API tokens downloaded.');
  });

  it('opens feedback dialog from the top menu with a selected 512 character input', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;

    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const menuButton = root.querySelector('.top-menu-button') as HTMLButtonElement | null;
    menuButton?.click();
    fixture.detectChanges();

    const feedbackButton = Array.from(root.querySelectorAll<HTMLButtonElement>('.top-menu-action'))
      .find((button): button is HTMLButtonElement => button.textContent?.includes('Send Feedback') ?? false);
    feedbackButton?.click();
    fixture.detectChanges();
    tick();

    const textarea = root.querySelector('.feedback-dialog textarea') as HTMLTextAreaElement | null;
    expect(app.feedbackDialogOpen).toBeTrue();
    expect(textarea).not.toBeNull();
    expect(textarea?.getAttribute('maxlength')).toBe('512');
    expect(document.activeElement).toBe(textarea);
    expect(textarea?.selectionStart).toBe(0);
    expect(textarea?.selectionEnd).toBe(textarea?.value.length);
  }));

  it('submits trimmed feedback and closes the dialog', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.isLoggedIn = true;
    app.username = 'user';
    app.password = 'password123';
    app.feedbackDialogOpen = true;
    app.feedbackMessage = '  please add more charts  ';

    app.sendFeedback();

    expect(marketDashboardService.submitFeedback).toHaveBeenCalledOnceWith('user', 'password123', 'please add more charts');
    expect(app.feedbackDialogOpen).toBeFalse();
    expect(app.snackbarMessage).toBe('Feedback sent. Thank you.');
  });
});
