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
      'searchSymbols',
      'ensureGlobalIndicatorChart',
      'getGlobalIndicatorChartRange',
      'setGlobalIndicatorChartRange',
      'globalIndicatorChartPoints',
      'isGlobalIndicatorChartLoading',
      'formatNotificationDays',
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
    marketDashboardService.fetchStockHistory.and.returnValue(of({ id: 'AAPL', range: '1m', points: [] }));
    marketDashboardService.fetchIndicatorHistory.and.returnValue(of({ id: 'vix', range: '1m', points: [] }));
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
    marketDashboardService.searchSymbols.and.returnValue(of([]));
    marketDashboardService.getGlobalIndicatorChartRange.and.returnValue('1m');
    marketDashboardService.globalIndicatorChartPoints.and.returnValue([]);
    marketDashboardService.isGlobalIndicatorChartLoading.and.returnValue(false);
    marketDashboardService.formatNotificationDays.and.callFake((days: string[]) => days.join(', '));

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
    expect(metrics?.textContent).toContain('Today');
    expect(metrics?.textContent).toContain('1.21%');
    expect(metrics?.textContent).toContain('$2.34');
    expect(metrics?.textContent).toContain('Market Cap');
    expect(metrics?.textContent).toContain('$3T');
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
    expect(row?.textContent).toContain('Today');
    expect(row?.textContent).toContain('Market Cap');
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
});
