import { ElementRef } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NEVER, of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { StockAlert, SymbolSearchResult } from './market-dashboard.models';
import { MarketDashboardService } from './market-dashboard.service';
import { JeniusAuthService } from './jenius-auth.service';

describe('AppComponent', () => {
  let marketDashboardService: jasmine.SpyObj<MarketDashboardService>;

  let jeniusAuthService: jasmine.SpyObj<JeniusAuthService>;
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
    document.cookie = 'sma_username=; Max-Age=0; Path=/; SameSite=Lax';
    document.cookie = 'sma_password=; Max-Age=0; Path=/; SameSite=Lax';
    jeniusAuthService = jasmine.createSpyObj<JeniusAuthService>('JeniusAuthService', [
      'initialize',
      'startLogin',
      'startRegistration',
      'logout',
    ]);
    jeniusAuthService.initialize.and.resolveTo(null);
    marketDashboardService = jasmine.createSpyObj<MarketDashboardService>('MarketDashboardService', [
      'createUser',
      'fetchDashboard',
      'fetchIndicators',
      'fetchStocks',
      'fetchStockPrices',
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
    marketDashboardService.fetchStockPrices.and.returnValue(of([]));
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
        { provide: JeniusAuthService, useValue: jeniusAuthService },
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

  it('shows the Jenius Tech SRL company footer without an address', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const footer = fixture.nativeElement.querySelector('.company-footer') as HTMLElement;
    const jeniusAppsLink = footer.querySelector<HTMLAnchorElement>('.company-footer__link');

    expect(footer.textContent).toContain('Jenius Tech SRL');
    expect(footer.textContent).toContain('VAT BE 0789.424.602');
    expect(footer.textContent).toContain('Designed and developed in Belgium.');
    expect(footer.textContent).not.toContain('Brussels');
    expect(jeniusAppsLink?.getAttribute('href')).toBe('https://jeniusapps.com');
    expect(jeniusAppsLink?.getAttribute('target')).toBe('_blank');
  });

  it('uses generated PNG logo assets for the header and welcome screen', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    app.isLoggedIn = false;
    app.isLoading = false;
    app.username = '';
    app.password = '';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const headerLogo = compiled.querySelector<HTMLImageElement>('.brand-mark');
    const welcomeLogo = compiled.querySelector<HTMLImageElement>('.welcome-logo');

    expect(headerLogo?.getAttribute('src')).toBe('openfire-logo-48.png');
    expect(headerLogo?.getAttribute('srcset')).toContain('openfire-logo-96.png 2x');
    expect(welcomeLogo?.getAttribute('src')).toBe('openfire-logo-128.png');
    expect(welcomeLogo?.getAttribute('srcset')).toContain('openfire-logo-256.png 2x');
  });

  it('hides the header authentication actions while authentication is loading', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    app.isLoggedIn = false;
    app.isLoading = true;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('app-header') as HTMLElement;
    const authButtons = Array.from(header.querySelectorAll('button'))
      .filter((button) => ['Login', 'Create user'].includes(button.textContent?.trim() ?? ''));
    expect(authButtons).toHaveSize(0);
    expect(fixture.nativeElement.textContent).toContain('Loading your dashboard...');
  });

  it('shows Jenius Apps and source-code links in the header menu', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.top-menu-button')?.click();
    fixture.detectChanges();

    const jeniusAppsLink = root.querySelector<HTMLAnchorElement>('.jenius-apps-menu-action');
    const sourceLink = root.querySelector<HTMLAnchorElement>('.github-menu-action');
    expect(jeniusAppsLink?.textContent?.trim()).toBe('Jenius Apps');
    expect(jeniusAppsLink?.getAttribute('href')).toBe('https://jeniusapps.com');
    expect(jeniusAppsLink?.getAttribute('target')).toBe('_blank');
    expect(jeniusAppsLink?.getAttribute('aria-label')).toContain('opens in a new tab');
    expect(sourceLink?.textContent?.trim()).toBe('Open Source Code');
    expect(sourceLink?.getAttribute('href')).toBe('https://github.com/mjarmak/open-fire');
    expect(sourceLink?.getAttribute('target')).toBe('_blank');
    expect(sourceLink?.getAttribute('aria-label')).toContain('opens in a new tab');
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

  it('renders position prices before risk details finish loading', () => {
    const price = stockLookupRisk({
      id: 7,
      quantity: 3,
      averageCost: 100,
      latestPrice: 110,
      marketValue: 330,
      costBasis: 300,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: null,
      thirtyDayChangePercent: null,
      reason: 'Risk details are loading.',
    });
    const details$ = new Subject<StockAlert[]>();
    marketDashboardService.fetchStockPrices.and.returnValue(of([price]));
    marketDashboardService.fetchStocks.and.returnValue(details$);
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    app.refreshDashboard();

    expect(app.stocks[0].latestPrice).toBe(110);
    expect(app.stocks[0].marketValue).toBe(330);
    expect(app.stocks[0].peRatio).toBeNull();
    expect(marketDashboardService.isLoadingStocks).toBeFalse();
    expect(marketDashboardService.isLoadingStockDetails).toBeTrue();
    expect(app.isLoading).toBeFalse();

    details$.next([stockLookupRisk({ id: 7, peRatio: 28, fearScore: 41, thirtyDayChangePercent: 6.5 })]);
    details$.complete();

    expect(app.stocks[0].latestPrice).toBe(110);
    expect(app.stocks[0].marketValue).toBe(330);
    expect(app.stocks[0].peRatio).toBe(28);
    expect(app.stocks[0].fearScore).toBe(41);
    expect(app.stocks[0].thirtyDayChangePercent).toBe(6.5);
    expect(marketDashboardService.isLoadingStockDetails).toBeFalse();
  });

  it('retries stock details when a response is missing a required price', fakeAsync(() => {
    const price = stockLookupRisk({
      id: 7,
      symbol: 'AAPL',
      latestPrice: 110,
      marketValue: 330,
      costBasis: 300,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: null,
      thirtyDayChangePercent: null,
    });
    const unavailableDetails = stockLookupRisk({
      id: 7,
      symbol: 'AAPL',
      latestPrice: null,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: null,
      thirtyDayChangePercent: null,
      reason: 'Live market data is not available for this symbol yet.',
    });
    const completeDetails = stockLookupRisk({ id: 7, symbol: 'AAPL', latestPrice: 110, fearScore: 44 });
    marketDashboardService.fetchStockPrices.and.returnValue(of([price]));
    marketDashboardService.fetchStocks.and.returnValues(of([unavailableDetails]), of([completeDetails]));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    app.refreshDashboard();

    expect(marketDashboardService.fetchStocks).toHaveBeenCalledTimes(1);
    expect(marketDashboardService.isLoadingStockDetails).toBeTrue();

    tick(1000);

    expect(marketDashboardService.fetchStocks).toHaveBeenCalledTimes(2);
    expect(app.stocks[0].fearScore).toBe(44);
    expect(marketDashboardService.isLoadingStockDetails).toBeFalse();
  }));

  it('accepts partial foreign stock details without retrying', () => {
    const price = stockLookupRisk({
      id: 8,
      symbol: '3GP',
      companyName: 'Xiaomi',
      latestPrice: 4,
      marketValue: 40,
      costBasis: 30,
    });
    const partialDetails = stockLookupRisk({
      id: 8,
      symbol: '3GP',
      companyName: 'Xiaomi',
      latestPrice: 4,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: 12,
      thirtyDayChangePercent: 0,
    });
    marketDashboardService.fetchStockPrices.and.returnValue(of([price]));
    marketDashboardService.fetchStocks.and.returnValue(of([partialDetails]));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    app.refreshDashboard();

    expect(marketDashboardService.fetchStocks).toHaveBeenCalledTimes(1);
    expect(app.stocks[0].latestPrice).toBe(4);
    expect(app.stocks[0].peRatio).toBeNull();
    expect(app.stocks[0].fearScore).toBe(12);
    expect(marketDashboardService.isLoadingStockDetails).toBeFalse();
  });

  it('loads DCA settings independently of pending dashboard requests', () => {
    marketDashboardService.fetchIndicators.and.returnValue(NEVER);
    marketDashboardService.fetchStockPrices.and.returnValue(NEVER);
    marketDashboardService.fetchPortfolio.and.returnValue(NEVER);
    marketDashboardService.notificationStatus.and.returnValue(NEVER);
    const dcaSettings$ = new Subject<{
      telegramDcaEnabled: boolean;
      reminderNote: string;
      reminderDays: string[];
    }>();
    marketDashboardService.dcaSettings.and.returnValue(dcaSettings$);

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    app.refreshDashboard();

    expect(marketDashboardService.dcaSettings).toHaveBeenCalledOnceWith('demoUser', 'demoPass123');
    expect(app.isLoggedIn).toBeFalse();
    expect(app.isLoadingDca).toBeTrue();

    dcaSettings$.next({
      telegramDcaEnabled: true,
      reminderNote: 'Invest on schedule.',
      reminderDays: ['MON'],
    });
    dcaSettings$.complete();

    expect(app.telegramDcaEnabled).toBeTrue();
    expect(app.dcaReminderNote).toBe('Invest on schedule.');
    expect(app.dcaReminderDays).toEqual(['MON']);
    expect(app.hasLoadedDcaSettings).toBeTrue();
    expect(app.isLoadingDca).toBeFalse();
  });

  it('loads retirement settings independently of pending dashboard requests', () => {
    marketDashboardService.fetchIndicators.and.returnValue(NEVER);
    marketDashboardService.fetchStockPrices.and.returnValue(NEVER);
    marketDashboardService.fetchPortfolio.and.returnValue(NEVER);
    marketDashboardService.notificationStatus.and.returnValue(NEVER);
    const retirementSettings$ = new Subject<{
      investingStartDate: string | null;
      desiredMonthlyIncome: number | null;
      customReturnRate: number | null;
      monthlySavings: number | null;
      otherSavings: number | null;
      yearlyInflationRate: number | null;
      safeWithdrawalRate: number | null;
    }>();
    marketDashboardService.retirementSettings.and.returnValue(retirementSettings$);
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';

    app.refreshDashboard();

    expect(marketDashboardService.retirementSettings).toHaveBeenCalledOnceWith('demoUser', 'demoPass123');
    expect(app.isLoggedIn).toBeFalse();
    expect(app.isLoadingRetirement).toBeTrue();

    retirementSettings$.next({
      investingStartDate: '2022-01-01',
      desiredMonthlyIncome: 3500,
      customReturnRate: 9,
      monthlySavings: 750,
      otherSavings: 20000,
      yearlyInflationRate: 2.5,
      safeWithdrawalRate: 3.5,
    });
    retirementSettings$.complete();

    expect(app.investingStartDate).toBe('2022-01-01');
    expect(app.desiredMonthlyIncome).toBe(3500);
    expect(app.monthlySavings).toBe(750);
    expect(app.hasLoadedRetirementSettings).toBeTrue();
    expect(app.isLoadingRetirement).toBeFalse();
  });

  it('logout clears stored login data but keeps the remember-username preference', () => {
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

  it('clears legacy credentials and loads the authenticated Jenius user', fakeAsync(() => {
    localStorage.setItem('sma_username', 'demoUser');
    localStorage.setItem('sma_password', 'legacyPassword123');
    localStorage.setItem('sma_remember_login', 'true');
    document.cookie = 'sma_password=legacyCookiePassword; Path=/; SameSite=Lax';
    jeniusAuthService.initialize.and.callFake(() => {
      localStorage.removeItem('sma_username');
      localStorage.removeItem('sma_password');
      localStorage.removeItem('sma_remember_login');
      document.cookie = 'sma_password=; Max-Age=0; Path=/; SameSite=Lax';
      return Promise.resolve({ username: 'demoUser', userId: 'jenius-user-id' });
    });


    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    app.ngOnInit();

    flushMicrotasks();
    expect(app.username).toBe('demoUser');
    expect(app.password).toBe('');
    expect(localStorage.getItem('sma_username')).toBeNull();
    expect(localStorage.getItem('sma_password')).toBeNull();
    expect(document.cookie).not.toContain('sma_password=');
    expect(marketDashboardService.fetchIndicators).toHaveBeenCalledOnceWith('demoUser', '');
    expect(marketDashboardService.fetchStockPrices).toHaveBeenCalledOnceWith('demoUser', '');
    expect(marketDashboardService.fetchPortfolio).toHaveBeenCalledOnceWith('demoUser', '');
    expect(marketDashboardService.notificationStatus).toHaveBeenCalledOnceWith('demoUser', '');
  }));

  it('never persists a password after a successful login', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'demoUser';
    app.password = 'demoPass123';
    app.rememberLogin = true;

    app.refreshDashboard(true);

    expect(localStorage.getItem('sma_username')).toBeNull();
    expect(localStorage.getItem('sma_password')).toBeNull();
    expect(document.cookie).not.toContain('sma_username=');
    expect(document.cookie).not.toContain('sma_password=');
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

  it('opens feedback from the snackbar action for 5xx dashboard errors', fakeAsync(() => {
    spyOn(console, 'error');
    marketDashboardService.fetchIndicators.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.username = 'user';
    app.password = 'password123';

    app.refreshDashboard();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const feedbackButton = root.querySelector<HTMLButtonElement>('.snackbar-action');
    expect(app.snackbarMessage).toContain('Some dashboard indicator data could not load');
    expect(app.snackbarAction).toBe('feedback');
    expect(feedbackButton?.textContent?.trim()).toBe('Send feedback');

    feedbackButton?.click();
    fixture.detectChanges();
    tick();

    expect(app.feedbackDialogOpen).toBeTrue();
    expect(app.snackbarMessage).toBe('');
  }));

  it('opens login and clears the entered password when every dashboard request returns unauthorized', () => {
    const unauthorized = throwError(() => new HttpErrorResponse({ status: 401 }));
    marketDashboardService.fetchIndicators.and.returnValue(unauthorized);
    marketDashboardService.fetchStockPrices.and.returnValue(unauthorized);
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

  it('loads watchlist indicators after adding a lightweight search result', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const details$ = new Subject<StockAlert[]>();
    const savedHolding = {
      id: 43,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      quantity: 0,
      averageCost: 0,
      watchOnly: true,
    };
    const price = stockLookupRisk({
      id: null,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      latestPrice: 420,
      marketCap: 3_100_000_000_000,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: null,
      thirtyDayChangePercent: null,
    });
    marketDashboardService.saveHolding.and.returnValue(of(savedHolding));
    marketDashboardService.fetchStocks.and.returnValue(details$);
    app.username = 'user';
    app.password = 'password123';
    app.selectedSymbol = {
      symbol: 'MSFT',
      name: 'Microsoft',
      region: 'US',
      currency: 'USD',
      indicators: price,
    };
    app.holdingForm = { ...savedHolding, id: null };

    app.saveHolding();

    expect(marketDashboardService.fetchStocks).toHaveBeenCalledOnceWith('user', 'password123');
    expect(marketDashboardService.isLoadingStockDetails).toBeTrue();
    expect(app.stocks[0]).toEqual(jasmine.objectContaining({
      id: 43,
      watchOnly: true,
      latestPrice: 420,
      fearScore: null,
    }));

    details$.next([stockLookupRisk({
      id: 43,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      peRatio: 35,
      beta: 1.1,
      realizedVolatilityPercent: 24,
      drawdownPercent: 8,
      fearScore: 47,
      thirtyDayChangePercent: 4.5,
      watchOnly: true,
    })]);
    details$.complete();

    expect(app.stocks[0]).toEqual(jasmine.objectContaining({
      peRatio: 35,
      beta: 1.1,
      realizedVolatilityPercent: 24,
      drawdownPercent: 8,
      fearScore: 47,
      thirtyDayChangePercent: 4.5,
    }));
    expect(marketDashboardService.isLoadingStockDetails).toBeFalse();
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
    expect(root.textContent).toContain('Primary source for stock search, quotes, company details, risk inputs, and price history.');
    expect(root.textContent).toContain('Fallback source for stock search, quotes, company details, and price history when Finnhub has no usable data.');
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
      twelvedata: 'twelve-token',
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
      { provider: 'twelvedata', name: 'Twelve Data', token: 'twelve-token' },
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
    expect(root.querySelector('.feedback-dialog .eyebrow')).toBeNull();
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
