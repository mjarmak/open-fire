import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { AppComponent } from './app.component';
import { SymbolSearchResult } from './market-dashboard.models';
import { MarketDashboardService } from './market-dashboard.service';

describe('AppComponent', () => {
  let marketDashboardService: jasmine.SpyObj<MarketDashboardService>;

  beforeEach(async () => {
    localStorage.clear();
    marketDashboardService = jasmine.createSpyObj<MarketDashboardService>('MarketDashboardService', [
      'fetchIndicators',
      'fetchStocks',
      'fetchPortfolio',
      'notificationStatus',
      'retirementSettings',
      'dcaSettings',
      'searchSymbols',
    ]);
    marketDashboardService.fetchIndicators.and.returnValue(of([]));
    marketDashboardService.fetchStocks.and.returnValue(of([]));
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
    }));
    marketDashboardService.searchSymbols.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: MarketDashboardService, useValue: marketDashboardService },
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
    app.holdingForm = { symbol: '', companyName: '', quantity: 1, averageCost: 10, watchOnly: false };

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
    app.holdingForm = { symbol: 'TSLA', companyName: 'Tesla', quantity: 0, averageCost: 0, watchOnly: true };
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
});
