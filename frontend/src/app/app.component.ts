import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterOutlet } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { DashboardResponse, IndicatorSnapshot, PortfolioHolding, StockAlert, SymbolSearchResult, UserDcaSettings, UserRetirementSettings } from './market-dashboard.models';
import { MarketDashboardService } from './market-dashboard.service';
import { AddPositionDialogComponent } from './components/add-position-dialog/add-position-dialog.component';
import { AlertsDialogComponent } from './components/alerts-dialog/alerts-dialog.component';
import { DcaPanelComponent } from './components/dca-panel/dca-panel.component';
import { DcaSettingsDialogComponent } from './components/dca-settings-dialog/dca-settings-dialog.component';
import { DeleteConfirmDialogComponent } from './components/delete-confirm-dialog/delete-confirm-dialog.component';
import { EditPositionDialogComponent } from './components/edit-position-dialog/edit-position-dialog.component';
import { HeaderComponent } from './components/header/header.component';
import { IndicatorGridComponent } from './components/indicator-grid/indicator-grid.component';
import { LoginDialogComponent } from './components/login-dialog/login-dialog.component';
import { PortfolioBoardComponent } from './components/portfolio-board/portfolio-board.component';
import { RetirementPlannerComponent } from './components/retirement-planner/retirement-planner.component';
import { RetirementSettingsDialogComponent } from './components/retirement-settings-dialog/retirement-settings-dialog.component';
import { TelegramDialogComponent } from './components/telegram-dialog/telegram-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    AddPositionDialogComponent,
    AlertsDialogComponent,
    DcaPanelComponent,
    DcaSettingsDialogComponent,
    DeleteConfirmDialogComponent,
    EditPositionDialogComponent,
    HeaderComponent,
    IndicatorGridComponent,
    LoginDialogComponent,
    PortfolioBoardComponent,
    RetirementPlannerComponent,
    RetirementSettingsDialogComponent,
    TelegramDialogComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.light-theme]': "themeMode === 'light'",
    '[class.dark-theme]': "themeMode === 'dark'",
  }
})
export class AppComponent implements OnDestroy, OnInit {
  private readonly usernameCookie = 'sma_username';
  private readonly passwordCookie = 'sma_password';
  private readonly usernameStorageKey = 'sma_username';
  private readonly passwordStorageKey = 'sma_password';
  private readonly rememberLoginStorageKey = 'sma_remember_login';
  private readonly themeStorageKey = 'sma_theme';
  private readonly loginCookieMaxAgeSeconds = 60 * 60 * 24 * 14;
  private symbolSearchHandle?: ReturnType<typeof setTimeout>;
  private editSymbolSearchHandle?: ReturnType<typeof setTimeout>;
  private snackbarHandle?: ReturnType<typeof setTimeout>;
  private dashboardLoadToken = 0;

  constructor(public readonly marketDashboardService: MarketDashboardService) {}

  get title(): string { return this.marketDashboardService.title; }
  get themeMode(): 'dark' | 'light' { return this.marketDashboardService.themeMode; }
  set themeMode(value: 'dark' | 'light') { this.marketDashboardService.themeMode = value; }
  get username(): string { return this.marketDashboardService.username; }
  set username(value: string) { this.marketDashboardService.username = value; }
  get password(): string { return this.marketDashboardService.password; }
  set password(value: string) { this.marketDashboardService.password = value; }
  get rememberLogin(): boolean { return this.marketDashboardService.rememberLogin; }
  set rememberLogin(value: boolean) { this.marketDashboardService.rememberLogin = value; }
  get isLoading(): boolean { return this.marketDashboardService.isLoading; }
  set isLoading(value: boolean) { this.marketDashboardService.isLoading = value; }
  get isLoggedIn(): boolean { return this.marketDashboardService.isLoggedIn; }
  set isLoggedIn(value: boolean) { this.marketDashboardService.isLoggedIn = value; }
  get isSavingHolding(): boolean { return this.marketDashboardService.isSavingHolding; }
  set isSavingHolding(value: boolean) { this.marketDashboardService.isSavingHolding = value; }
  get isImportingPortfolio(): boolean { return this.marketDashboardService.isImportingPortfolio; }
  set isImportingPortfolio(value: boolean) { this.marketDashboardService.isImportingPortfolio = value; }
  get snackbarMessage(): string { return this.marketDashboardService.snackbarMessage; }
  set snackbarMessage(value: string) { this.marketDashboardService.snackbarMessage = value; }
  get snackbarTone(): 'neutral' | 'error' { return this.marketDashboardService.snackbarTone; }
  set snackbarTone(value: 'neutral' | 'error') { this.marketDashboardService.snackbarTone = value; }
  get loginDialogOpen(): boolean { return this.marketDashboardService.loginDialogOpen; }
  set loginDialogOpen(value: boolean) { this.marketDashboardService.loginDialogOpen = value; }
  get authDialogMode(): 'login' | 'create' { return this.marketDashboardService.authDialogMode; }
  set authDialogMode(value: 'login' | 'create') { this.marketDashboardService.authDialogMode = value; }
  get addDialogOpen(): boolean { return this.marketDashboardService.addDialogOpen; }
  set addDialogOpen(value: boolean) { this.marketDashboardService.addDialogOpen = value; }
  get symbolQuery(): string { return this.marketDashboardService.symbolQuery; }
  set symbolQuery(value: string) { this.marketDashboardService.symbolQuery = value; }
  get symbolSuggestions(): SymbolSearchResult[] { return this.marketDashboardService.symbolSuggestions; }
  set symbolSuggestions(value: SymbolSearchResult[]) { this.marketDashboardService.symbolSuggestions = value; }
  get selectedSymbol(): SymbolSearchResult | undefined { return this.marketDashboardService.selectedSymbol; }
  set selectedSymbol(value: SymbolSearchResult | undefined) { this.marketDashboardService.selectedSymbol = value; }
  get showSymbolDropdown(): boolean { return this.marketDashboardService.showSymbolDropdown; }
  set showSymbolDropdown(value: boolean) { this.marketDashboardService.showSymbolDropdown = value; }
  get symbolMessage(): string { return this.marketDashboardService.symbolMessage; }
  set symbolMessage(value: string) { this.marketDashboardService.symbolMessage = value; }
  get editDialogOpen(): boolean { return this.marketDashboardService.editDialogOpen; }
  set editDialogOpen(value: boolean) { this.marketDashboardService.editDialogOpen = value; }
  get editOriginalSymbol(): string { return this.marketDashboardService.editOriginalSymbol; }
  set editOriginalSymbol(value: string) { this.marketDashboardService.editOriginalSymbol = value; }
  get editSymbolQuery(): string { return this.marketDashboardService.editSymbolQuery; }
  set editSymbolQuery(value: string) { this.marketDashboardService.editSymbolQuery = value; }
  get editSymbolSuggestions(): SymbolSearchResult[] { return this.marketDashboardService.editSymbolSuggestions; }
  set editSymbolSuggestions(value: SymbolSearchResult[]) { this.marketDashboardService.editSymbolSuggestions = value; }
  get selectedEditSymbol(): SymbolSearchResult | undefined { return this.marketDashboardService.selectedEditSymbol; }
  set selectedEditSymbol(value: SymbolSearchResult | undefined) { this.marketDashboardService.selectedEditSymbol = value; }
  get showEditSymbolDropdown(): boolean { return this.marketDashboardService.showEditSymbolDropdown; }
  set showEditSymbolDropdown(value: boolean) { this.marketDashboardService.showEditSymbolDropdown = value; }
  get editSymbolMessage(): string { return this.marketDashboardService.editSymbolMessage; }
  set editSymbolMessage(value: string) { this.marketDashboardService.editSymbolMessage = value; }
  get deleteDialogOpen(): boolean { return this.marketDashboardService.deleteDialogOpen; }
  set deleteDialogOpen(value: boolean) { this.marketDashboardService.deleteDialogOpen = value; }
  get deleteTargetSymbol(): string { return this.marketDashboardService.deleteTargetSymbol; }
  set deleteTargetSymbol(value: string) { this.marketDashboardService.deleteTargetSymbol = value; }
  get alertsDialogOpen(): boolean { return this.marketDashboardService.alertsDialogOpen; }
  set alertsDialogOpen(value: boolean) { this.marketDashboardService.alertsDialogOpen = value; }
  get telegramDialogOpen(): boolean { return this.marketDashboardService.telegramDialogOpen; }
  set telegramDialogOpen(value: boolean) { this.marketDashboardService.telegramDialogOpen = value; }
  get telegramChatId(): string { return this.marketDashboardService.telegramChatId; }
  set telegramChatId(value: string) { this.marketDashboardService.telegramChatId = value; }
  get isSavingTelegram(): boolean { return this.marketDashboardService.isSavingTelegram; }
  set isSavingTelegram(value: boolean) { this.marketDashboardService.isSavingTelegram = value; }
  get dcaDialogOpen(): boolean { return this.marketDashboardService.dcaDialogOpen; }
  set dcaDialogOpen(value: boolean) { this.marketDashboardService.dcaDialogOpen = value; }
  get dcaSuggestionDialogOpen(): boolean { return this.marketDashboardService.dcaSuggestionDialogOpen; }
  set dcaSuggestionDialogOpen(value: boolean) { this.marketDashboardService.dcaSuggestionDialogOpen = value; }
  get isLoadingDca(): boolean { return this.marketDashboardService.isLoadingDca; }
  set isLoadingDca(value: boolean) { this.marketDashboardService.isLoadingDca = value; }
  get isSavingDca(): boolean { return this.marketDashboardService.isSavingDca; }
  set isSavingDca(value: boolean) { this.marketDashboardService.isSavingDca = value; }
  get hasLoadedDcaSettings(): boolean { return this.marketDashboardService.hasLoadedDcaSettings; }
  set hasLoadedDcaSettings(value: boolean) { this.marketDashboardService.hasLoadedDcaSettings = value; }
  get telegramDcaEnabled(): boolean { return this.marketDashboardService.telegramDcaEnabled; }
  set telegramDcaEnabled(value: boolean) { this.marketDashboardService.telegramDcaEnabled = value; }
  get dcaReminderNote(): string { return this.marketDashboardService.dcaReminderNote; }
  set dcaReminderNote(value: string) { this.marketDashboardService.dcaReminderNote = value; }
  get draftTelegramDcaEnabled(): boolean { return this.marketDashboardService.draftTelegramDcaEnabled; }
  set draftTelegramDcaEnabled(value: boolean) { this.marketDashboardService.draftTelegramDcaEnabled = value; }
  get draftDcaReminderNote(): string { return this.marketDashboardService.draftDcaReminderNote; }
  set draftDcaReminderNote(value: string) { this.marketDashboardService.draftDcaReminderNote = value; }
  get retirementSettingsOpen(): boolean { return this.marketDashboardService.retirementSettingsOpen; }
  set retirementSettingsOpen(value: boolean) { this.marketDashboardService.retirementSettingsOpen = value; }
  get isLoadingRetirement(): boolean { return this.marketDashboardService.isLoadingRetirement; }
  set isLoadingRetirement(value: boolean) { this.marketDashboardService.isLoadingRetirement = value; }
  get hasLoadedRetirementSettings(): boolean { return this.marketDashboardService.hasLoadedRetirementSettings; }
  set hasLoadedRetirementSettings(value: boolean) { this.marketDashboardService.hasLoadedRetirementSettings = value; }
  get investingStartDate(): string { return this.marketDashboardService.investingStartDate; }
  set investingStartDate(value: string) { this.marketDashboardService.investingStartDate = value; }
  get desiredMonthlyIncome(): number { return this.marketDashboardService.desiredMonthlyIncome; }
  set desiredMonthlyIncome(value: number) { this.marketDashboardService.desiredMonthlyIncome = value; }
  get customReturnRate(): number { return this.marketDashboardService.customReturnRate; }
  set customReturnRate(value: number) { this.marketDashboardService.customReturnRate = value; }
  get yearlyInflationRate(): number { return this.marketDashboardService.yearlyInflationRate; }
  set yearlyInflationRate(value: number) { this.marketDashboardService.yearlyInflationRate = value; }
  get safeWithdrawalRate(): number { return this.marketDashboardService.safeWithdrawalRate; }
  set safeWithdrawalRate(value: number) { this.marketDashboardService.safeWithdrawalRate = value; }
  get monthlySavings(): number { return this.marketDashboardService.monthlySavings; }
  set monthlySavings(value: number) { this.marketDashboardService.monthlySavings = value; }
  get otherSavings(): number { return this.marketDashboardService.otherSavings; }
  set otherSavings(value: number) { this.marketDashboardService.otherSavings = value; }
  get draftInvestingStartDate(): string { return this.marketDashboardService.draftInvestingStartDate; }
  set draftInvestingStartDate(value: string) { this.marketDashboardService.draftInvestingStartDate = value; }
  get draftDesiredMonthlyIncome(): number { return this.marketDashboardService.draftDesiredMonthlyIncome; }
  set draftDesiredMonthlyIncome(value: number) { this.marketDashboardService.draftDesiredMonthlyIncome = value; }
  get draftCustomReturnRate(): number { return this.marketDashboardService.draftCustomReturnRate; }
  set draftCustomReturnRate(value: number) { this.marketDashboardService.draftCustomReturnRate = value; }
  get draftYearlyInflationRate(): number { return this.marketDashboardService.draftYearlyInflationRate; }
  set draftYearlyInflationRate(value: number) { this.marketDashboardService.draftYearlyInflationRate = value; }
  get draftSafeWithdrawalRate(): number { return this.marketDashboardService.draftSafeWithdrawalRate; }
  set draftSafeWithdrawalRate(value: number) { this.marketDashboardService.draftSafeWithdrawalRate = value; }
  get draftMonthlySavings(): number { return this.marketDashboardService.draftMonthlySavings; }
  set draftMonthlySavings(value: number) { this.marketDashboardService.draftMonthlySavings = value; }
  get draftOtherSavings(): number { return this.marketDashboardService.draftOtherSavings; }
  set draftOtherSavings(value: number) { this.marketDashboardService.draftOtherSavings = value; }
  get isSavingRetirement(): boolean { return this.marketDashboardService.isSavingRetirement; }
  set isSavingRetirement(value: boolean) { this.marketDashboardService.isSavingRetirement = value; }
  get editForm(): PortfolioHolding { return this.marketDashboardService.editForm; }
  set editForm(value: PortfolioHolding) { this.marketDashboardService.editForm = value; }
  get holdingForm(): PortfolioHolding { return this.marketDashboardService.holdingForm; }
  set holdingForm(value: PortfolioHolding) { this.marketDashboardService.holdingForm = value; }
  get dashboard(): DashboardResponse { return this.marketDashboardService.dashboard; }
  set dashboard(value: DashboardResponse) { this.marketDashboardService.dashboard = value; }

  ngOnInit(): void {
    this.restoreTheme();
    this.restoreLoginCredentials();
  }

  ngOnDestroy(): void {
    if (this.symbolSearchHandle) {
      clearTimeout(this.symbolSearchHandle);
    }
    if (this.editSymbolSearchHandle) {
      clearTimeout(this.editSymbolSearchHandle);
    }
    if (this.snackbarHandle) {
      clearTimeout(this.snackbarHandle);
    }
  }

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
    const hasLinkedSymbol = this.holdingForm.symbol.trim().length > 0
      && (Boolean(this.selectedSymbol) || this.holdingForm.companyName.trim().length > 0);
    return hasLinkedSymbol
      && (this.holdingForm.watchOnly || this.holdingForm.quantity > 0)
      && (this.holdingForm.watchOnly || this.holdingForm.averageCost >= 0)
      && !this.isSavingHolding;
  }

  get canSaveEdit(): boolean {
    const symbolUnchanged = this.editForm.symbol.toUpperCase() === this.editOriginalSymbol.toUpperCase();
    const hasLinkedEditedSymbol = symbolUnchanged
      || (this.editForm.symbol.trim().length > 0
        && (Boolean(this.selectedEditSymbol) || this.editForm.companyName.trim().length > 0));
    return this.editDialogOpen
      && hasLinkedEditedSymbol
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

  get canSubmitAuth(): boolean {
    return this.authCredentialsValid && !this.isLoading;
  }

  toggleTheme(): void {
    this.themeMode = this.themeMode === 'dark' ? 'light' : 'dark';
    localStorage.setItem(this.themeStorageKey, this.themeMode);
  }

  private restoreTheme(): void {
    const storedTheme = localStorage.getItem(this.themeStorageKey);
    this.themeMode = storedTheme === 'light' ? 'light' : 'dark';
  }

  private showSnackbar(message: string, tone: 'neutral' | 'error' = 'neutral'): void {
    this.snackbarMessage = message;
    this.snackbarTone = tone;
    if (this.snackbarHandle) {
      clearTimeout(this.snackbarHandle);
    }
    this.snackbarHandle = setTimeout(() => {
      this.snackbarMessage = '';
    }, 4200);
  }

  refreshDashboard(clearCredentialsOnAuthFailure = false): void {
    if (!this.authCredentialsValid) {
      this.showSnackbar('Enter a username and password before logging in.', 'error');
      return;
    }

    this.username = this.username.trim();
    const loadToken = ++this.dashboardLoadToken;
    this.isLoading = true;
    this.dashboard = {
      ...this.dashboard,
      asOf: new Date().toISOString(),
    };

    const dashboardCallCount = 4;
    let pendingCalls = dashboardCallCount;
    let reportedError = false;
    let loadedRetirementSettings = false;
    let loadedDcaSettings = false;
    let successfulCalls = 0;
    let unauthorizedCalls = 0;
    const completeCall = () => {
      if (loadToken !== this.dashboardLoadToken) {
        return;
      }
      pendingCalls--;
      if (pendingCalls === 0) {
        this.isLoading = false;
        if (unauthorizedCalls === dashboardCallCount) {
          this.isLoggedIn = false;
          this.loginDialogOpen = true;
          if (clearCredentialsOnAuthFailure) {
            this.clearLoginCredentials();
            this.password = '';
          }
          this.showSnackbar('Login failed. Check your username and password.', 'error');
          return;
        }
        if (successfulCalls > 0 && unauthorizedCalls > 0 && !reportedError) {
          reportedError = true;
          this.showSnackbar('Some dashboard data could not load. The rest of the page will continue updating.', 'error');
        }
      }
    };
    const markAuthenticated = () => {
      if (loadToken !== this.dashboardLoadToken) {
        return;
      }
      successfulCalls++;
      this.isLoggedIn = true;
      this.loginDialogOpen = false;
      this.storeLoginCredentials();
      if (!loadedRetirementSettings) {
        loadedRetirementSettings = true;
        this.loadRetirementSettingsSilently();
      }
      if (!loadedDcaSettings) {
        loadedDcaSettings = true;
        this.loadDcaSettingsSilently();
      }
    };
    const handleLoadError = (error: HttpErrorResponse) => {
      if (loadToken !== this.dashboardLoadToken) {
        return;
      }
      if (error.status === 401) {
        unauthorizedCalls++;
        return;
      }
      if (!reportedError) {
        reportedError = true;
        this.showSnackbar('Some dashboard data could not load. The rest of the page will continue updating.', 'error');
      }
    };

    this.marketDashboardService.fetchIndicators(this.username, this.password)
      .pipe(finalize(completeCall))
      .subscribe({
        next: (indicators) => {
          markAuthenticated();
          this.dashboard = {
            ...this.dashboard,
            indicators,
            dailyReport: this.composeDailyReport(indicators, this.stocks),
          };
        },
        error: handleLoadError,
      });

    this.marketDashboardService.fetchStocks(this.username, this.password)
      .pipe(finalize(completeCall))
      .subscribe({
        next: (stocks) => {
          markAuthenticated();
          this.dashboard = {
            ...this.dashboard,
            stocks,
            dailyReport: this.composeDailyReport(this.indicators, stocks),
          };
        },
        error: handleLoadError,
      });

    this.marketDashboardService.fetchPortfolio(this.username, this.password)
      .pipe(finalize(completeCall))
      .subscribe({
        next: (portfolio) => {
          markAuthenticated();
          this.dashboard = {
            ...this.dashboard,
            portfolio,
          };
        },
        error: handleLoadError,
      });

    this.marketDashboardService.notificationStatus(this.username, this.password)
      .pipe(finalize(completeCall))
      .subscribe({
        next: (notification) => {
          markAuthenticated();
          this.dashboard = {
            ...this.dashboard,
            notification,
          };
        },
        error: handleLoadError,
      });
  }

  private composeDailyReport(indicators: IndicatorSnapshot[], stocks: StockAlert[]): string {
    if (!indicators.length && !stocks.length) {
      return 'No live market data is available yet. Add manual portfolio positions and configure provider keys to fetch market data.';
    }

    const riskIndicator = indicators.find((indicator) => ['risk', 'fear'].includes(indicator.status));
    const riskTone = riskIndicator
      ? `Risk is elevated because ${riskIndicator.name} is flashing ${riskIndicator.status}.`
      : indicators.length
      ? ''
      : 'Macro indicators are unavailable because no live provider data was returned.';

    const breadth = indicators.find((indicator) => indicator.id === 'breadth');
    const breadthText = breadth
      ? ` Breadth sits at ${this.formatCompactDecimal(breadth.value)}${breadth.unit}, so participation is ${breadth.status}.`
      : '';

    const alertCount = stocks.filter((stock) => stock.alert).length;
    const alerts = stocks.length === 0
      ? ' No fetched portfolio stock data is available.'
      : alertCount > 0
      ? ` ${alertCount} watched stock alert(s) need review before any trade.`
      : ' No watched stock alerts fired.';

    return (riskTone + breadthText + alerts).trim();
  }

  private formatCompactDecimal(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  openLoginDialog(): void {
    this.authDialogMode = 'login';
    this.loginDialogOpen = true;
  }

  openCreateUserDialog(): void {
    this.authDialogMode = 'create';
    this.loginDialogOpen = true;
  }

  closeLoginDialog(): void {
    this.loginDialogOpen = false;
  }

  logout(): void {
    this.dashboardLoadToken++;
    this.isLoading = false;
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
    this.clearLoginCredentials();
    this.hasLoadedDcaSettings = false;
    this.telegramDcaEnabled = false;
    this.dcaReminderNote = '';
    this.draftTelegramDcaEnabled = false;
    this.draftDcaReminderNote = '';
    this.dcaDialogOpen = false;
    this.dcaSuggestionDialogOpen = false;
    this.alertsDialogOpen = false;
    this.dashboard = this.emptyDashboard();
  }

  submitAuthDialog(): void {
    if (this.authDialogMode === 'create') {
      this.createUser();
      return;
    }

    this.refreshDashboard(true);
  }

  createUser(): void {
    if (!this.authCredentialsValid) {
      this.showSnackbar('Use a username with at least 3 characters and a password with at least 8 characters.', 'error');
      return;
    }

    this.username = this.username.trim();
    this.isLoading = true;
    this.marketDashboardService.createUser(this.username.trim(), this.password)
      .subscribe({
        next: (response) => {
          this.username = response.username;
          this.showSnackbar(`${response.username} created. Loading your portfolio.`);
          this.refreshDashboard(true);
        },
        error: () => {
          this.isLoading = false;
          this.isLoggedIn = false;
          this.showSnackbar('Could not create user. Make sure Postgres users are enabled and the username is not already taken.', 'error');
        },
      });
  }

  private restoreLoginCredentials(): void {
    const storedRemember = localStorage.getItem(this.rememberLoginStorageKey);
    this.rememberLogin = storedRemember !== 'false';
    const storedUsername = localStorage.getItem(this.usernameStorageKey) || this.readCookie(this.usernameCookie);
    const storedPassword = localStorage.getItem(this.passwordStorageKey) || this.readCookie(this.passwordCookie);
    if (!storedUsername || !storedPassword) {
      return;
    }

    this.username = storedUsername;
    this.password = storedPassword;
    this.refreshDashboard();
  }

  private storeLoginCredentials(): void {
    localStorage.setItem(this.rememberLoginStorageKey, String(this.rememberLogin));
    if (!this.rememberLogin) {
      this.clearLoginCredentials();
      return;
    }

    localStorage.setItem(this.usernameStorageKey, this.username);
    localStorage.setItem(this.passwordStorageKey, this.password);
    this.writeCookie(this.usernameCookie, this.username);
    this.writeCookie(this.passwordCookie, this.password);
  }

  private clearLoginCredentials(): void {
    localStorage.removeItem(this.usernameStorageKey);
    localStorage.removeItem(this.passwordStorageKey);
    this.deleteCookie(this.usernameCookie);
    this.deleteCookie(this.passwordCookie);
  }

  private readCookie(name: string): string {
    const prefix = `${name}=`;
    const cookie = document.cookie
      .split('; ')
      .find((item) => item.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : '';
  }

  private writeCookie(name: string, value: string): void {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${this.loginCookieMaxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
  }

  private deleteCookie(name: string): void {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  private emptyDashboard(): DashboardResponse {
    return {
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
  }

  openTelegramDialog(): void {
    if (!this.isLoggedIn) {
      this.openLoginDialog();
      this.showSnackbar('Login before setting up Telegram.', 'error');
      return;
    }

    this.telegramDialogOpen = true;
    this.marketDashboardService.telegramSettings(this.username, this.password).subscribe({
      next: (settings) => (this.telegramChatId = settings.chatId),
      error: () => this.showSnackbar('Could not load Telegram settings.', 'error'),
    });
  }

  openAlertsDialog(): void {
    if (!this.isLoggedIn) {
      this.openLoginDialog();
      this.showSnackbar('Login before reviewing alerts.', 'error');
      return;
    }

    this.alertsDialogOpen = true;
  }

  closeAlertsDialog(): void {
    this.alertsDialogOpen = false;
  }

  openTelegramFromAlertsDialog(): void {
    this.openTelegramDialog();
  }

  closeTelegramDialog(): void {
    this.telegramDialogOpen = false;
  }

  openDcaDialog(): void {
    if (!this.isLoggedIn) {
      this.openLoginDialog();
      this.showSnackbar('Login before editing DCA reminders.', 'error');
      return;
    }

    this.populateDcaDraft();
    this.dcaDialogOpen = true;
  }

  closeDcaDialog(): void {
    this.dcaDialogOpen = false;
  }

  openDcaSuggestionDialog(): void {
    this.dcaSuggestionDialogOpen = true;
  }

  closeDcaSuggestionDialog(): void {
    this.dcaSuggestionDialogOpen = false;
  }

  copyDcaSuggestion(sample: string): void {
    const maxDcaLength = this.marketDashboardService.dcaReminderMaxLength;
    const existing = this.draftDcaReminderNote.trim();
    const combined = existing.length ? `${existing}\n\n${sample}` : sample;
    const truncated = combined.slice(0, maxDcaLength);
    const wasTruncated = truncated.length < combined.length;
    this.draftDcaReminderNote = truncated;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(sample)
        .then(() => this.showSnackbar(wasTruncated
          ? `DCA sample appended and trimmed to ${maxDcaLength} characters.`
          : 'DCA sample appended.'))
        .catch(() => this.showSnackbar(wasTruncated
          ? 'DCA sample appended and trimmed. Copy to clipboard failed.'
          : 'DCA sample appended. Copy to clipboard failed.', 'error'));
    } else {
      this.showSnackbar(wasTruncated
        ? 'DCA sample appended and trimmed. Clipboard API is unavailable in this browser.'
        : 'DCA sample appended. Clipboard API is unavailable in this browser.', 'error');
    }
    this.closeDcaSuggestionDialog();
  }

  saveDcaSettings(): void {
    if (!this.isLoggedIn) {
      return;
    }

    this.isSavingDca = true;
    const settings: UserDcaSettings = {
      telegramDcaEnabled: this.draftTelegramDcaEnabled,
      reminderNote: this.draftDcaReminderNote.trim(),
    };
    this.marketDashboardService.saveDcaSettings(this.username, this.password, settings)
      .pipe(finalize(() => (this.isSavingDca = false)))
      .subscribe({
        next: (savedSettings) => {
          this.applyDcaSettings(savedSettings);
          this.showSnackbar('DCA reminder settings saved.');
          this.closeDcaDialog();
        },
        error: () => this.showSnackbar('Could not save DCA reminder settings.', 'error'),
      });
  }

  loadDcaSettingsSilently(): void {
    if (!this.isLoggedIn) {
      return;
    }

    this.isLoadingDca = true;
    this.marketDashboardService.dcaSettings(this.username, this.password).subscribe({
      next: (settings) => this.applyDcaSettings(settings),
      error: () => {
        this.hasLoadedDcaSettings = false;
        this.isLoadingDca = false;
      },
      complete: () => {
        this.isLoadingDca = false;
        this.hasLoadedDcaSettings = true;
      },
    });
  }

  openRetirementSettings(): void {
    if (!this.isLoggedIn) {
      this.openLoginDialog();
      this.showSnackbar('Login before planning retirement.', 'error');
      return;
    }
    this.populateRetirementDraft();
    this.retirementSettingsOpen = true;
  }

  closeRetirementSettings(): void {
    this.retirementSettingsOpen = false;
  }

  saveRetirementSettings(): void {
    if (!this.isLoggedIn) return;
    this.isSavingRetirement = true;
    const settings = {
      investingStartDate: this.draftInvestingStartDate || null,
      desiredMonthlyIncome: this.draftDesiredMonthlyIncome,
      customReturnRate: this.draftCustomReturnRate,
      monthlySavings: this.draftMonthlySavings,
      otherSavings: this.draftOtherSavings,
      yearlyInflationRate: this.draftYearlyInflationRate,
      safeWithdrawalRate: this.draftSafeWithdrawalRate,
    };
    this.marketDashboardService.saveRetirementSettings(this.username, this.password, settings)
      .pipe(finalize(() => this.isSavingRetirement = false))
      .subscribe({
        next: (res) => {
          this.applyRetirementSettings(res);
          this.showSnackbar('Retirement settings saved.');
          this.closeRetirementSettings();
        },
        error: () => this.showSnackbar('Could not save retirement settings.', 'error'),
      });
  }

  loadRetirementSettingsSilently(): void {
    if (!this.isLoggedIn) return;
    this.isLoadingRetirement = true;
    this.marketDashboardService.retirementSettings(this.username, this.password).subscribe({
      next: (settings) => this.applyRetirementSettings(settings),
      error: () => {
        this.hasLoadedRetirementSettings = false;
        this.isLoadingRetirement = false;
      },
      complete: () => {
        this.isLoadingRetirement = false;
        this.hasLoadedRetirementSettings = true;
      },
    });
  }

  private applyRetirementSettings(settings: UserRetirementSettings): void {
    this.investingStartDate = settings.investingStartDate || '';
    this.desiredMonthlyIncome = settings.desiredMonthlyIncome || 5000;
    this.customReturnRate = settings.customReturnRate || 12;
    this.yearlyInflationRate = settings.yearlyInflationRate ?? 3;
    this.safeWithdrawalRate = settings.safeWithdrawalRate ?? 4;
    this.monthlySavings = settings.monthlySavings || 500;
    this.otherSavings = settings.otherSavings || 10000;
  }

  private populateRetirementDraft(): void {
    this.draftInvestingStartDate = this.investingStartDate;
    this.draftDesiredMonthlyIncome = this.desiredMonthlyIncome;
    this.draftCustomReturnRate = this.customReturnRate;
    this.draftYearlyInflationRate = this.yearlyInflationRate;
    this.draftSafeWithdrawalRate = this.safeWithdrawalRate;
    this.draftMonthlySavings = this.monthlySavings;
    this.draftOtherSavings = this.otherSavings;
  }

  private applyDcaSettings(settings: UserDcaSettings): void {
    this.telegramDcaEnabled = settings.telegramDcaEnabled ?? false;
    this.dcaReminderNote = settings.reminderNote ?? '';
  }

  private populateDcaDraft(): void {
    this.draftTelegramDcaEnabled = this.telegramDcaEnabled;
    this.draftDcaReminderNote = this.dcaReminderNote;
  }

  saveTelegramChatId(): void {
    const chatId = this.telegramChatId.trim();
    if (!chatId) {
      this.showSnackbar('Enter your Telegram chat ID.', 'error');
      return;
    }

    this.isSavingTelegram = true;
    this.marketDashboardService.saveTelegramSettings(this.username, this.password, chatId)
      .pipe(finalize(() => (this.isSavingTelegram = false)))
      .subscribe({
        next: (settings) => {
          this.telegramChatId = settings.chatId;
          this.showSnackbar('Telegram chat ID saved.');
          this.closeTelegramDialog();
          this.refreshDashboard();
        },
        error: () => this.showSnackbar('Could not save Telegram chat ID.', 'error'),
      });
  }

  sendTelegramTest(): void {
    const chatId = this.telegramChatId.trim();
    if (!chatId) {
      this.showSnackbar('Enter your Telegram chat ID before testing.', 'error');
      return;
    }

    this.isSavingTelegram = true;
    this.marketDashboardService.saveTelegramSettings(this.username, this.password, chatId)
      .pipe(
        switchMap(() => this.marketDashboardService.sendTelegram(this.username, this.password, 'OpenFIRE Telegram test.')),
        finalize(() => (this.isSavingTelegram = false)),
      )
      .subscribe({
        next: (response) => this.handleTelegramSendResponse(response),
        error: () => this.showSnackbar('Telegram test failed. Check backend auth and Telegram settings.', 'error'),
      });
  }

  private handleTelegramSendResponse(response: { sent: boolean; message: string; missingChatId: boolean }): void {
    if (response.sent) {
      this.showSnackbar(response.message);
      return;
    }

    if (response.missingChatId) {
      this.telegramDialogOpen = true;
    }
    this.showSnackbar(response.message, 'error');
  }

  searchSymbols(): void {
    const query = this.symbolQuery.trim();
    if (this.symbolSearchHandle) {
      clearTimeout(this.symbolSearchHandle);
    }

    const selectedSymbolMatchesQuery = Boolean(
      this.selectedSymbol && query.toUpperCase() === this.selectedSymbol.symbol.toUpperCase(),
    );
    if (selectedSymbolMatchesQuery) {
      this.holdingForm.symbol = this.selectedSymbol!.symbol;
      this.symbolSuggestions = [];
      this.showSymbolDropdown = false;
      this.symbolMessage = `${this.selectedSymbol!.name} selected.`;
      return;
    }

    this.selectedSymbol = undefined;
    this.holdingForm.symbol = query.toUpperCase();
    this.holdingForm.companyName = '';

    if (query.length < 2) {
      this.symbolSuggestions = [];
      this.showSymbolDropdown = false;
      this.symbolMessage = 'Type at least 2 characters, then choose a stock from the dropdown.';
      return;
    }

    this.showSymbolDropdown = true;
    this.symbolMessage = 'Searching Finnhub...';
    this.symbolSearchHandle = setTimeout(() => {
      this.marketDashboardService.searchSymbols(this.username, this.password, query).subscribe({
        next: (results) => {
          if (query !== this.symbolQuery.trim()) {
            return;
          }

          this.symbolSuggestions = results;
          this.symbolMessage = results.length
            ? 'Choose one of the dropdown results to link this position.'
            : 'No matching stocks found. Try a different ticker or company name.';
        },
        error: () => {
          if (query !== this.symbolQuery.trim()) {
            return;
          }

          this.symbolSuggestions = [];
          this.symbolMessage = 'Could not search stocks. Check backend auth and Finnhub configuration.';
        },
      });
    }, 1000);
  }

  openSymbolDropdown(): void {
    this.showSymbolDropdown = this.symbolQuery.trim().length >= 2;
  }

  chooseSymbol(symbol: SymbolSearchResult): void {
    if (this.symbolSearchHandle) {
      clearTimeout(this.symbolSearchHandle);
      this.symbolSearchHandle = undefined;
    }
    this.selectedSymbol = symbol;
    this.holdingForm.symbol = symbol.symbol;
    this.symbolQuery = symbol.symbol;
    this.holdingForm.companyName = symbol.name;
    this.showSymbolDropdown = false;
    this.symbolMessage = `${symbol.name} selected.`;
  }

  openAddPosition(): void {
    this.isSavingHolding = false;
    this.resetAddForm();
    this.addDialogOpen = true;
  }

  closeAddPosition(): void {
    this.addDialogOpen = false;
    this.resetAddForm();
  }

  saveHolding(): void {
    if (!this.canSaveHolding) {
      this.showSnackbar('Choose an existing stock from the dropdown before adding it.', 'error');
      return;
    }

    this.isSavingHolding = true;
    this.marketDashboardService.saveHolding(this.username, this.password, this.holdingForm)
      .pipe(finalize(() => (this.isSavingHolding = false)))
      .subscribe({
        next: () => {
          this.showSnackbar(`${this.holdingForm.symbol} saved to portfolio.`);
          this.closeAddPosition();
          this.refreshDashboard();
        },
        error: () => {
          this.showSnackbar('Could not save holding. Check symbol, quantity, average cost, and backend auth.', 'error');
        },
      });
  }

  private resetAddForm(): void {
    this.holdingForm = { symbol: '', companyName: '', quantity: 0, averageCost: 0, watchOnly: false };
    this.symbolQuery = '';
    this.symbolSuggestions = [];
    this.selectedSymbol = undefined;
    this.showSymbolDropdown = false;
    this.symbolMessage = 'Start typing and choose a stock from the dropdown.';
    if (this.symbolSearchHandle) {
      clearTimeout(this.symbolSearchHandle);
    }
  }

  deleteHolding(symbol: string): void {
    this.marketDashboardService.deleteHolding(this.username, this.password, symbol).subscribe({
      next: () => {
        this.showSnackbar(`${symbol} removed from portfolio.`);
        this.refreshDashboard();
      },
      error: () => this.showSnackbar(`Could not remove ${symbol}.`, 'error'),
    });
  }

  confirmDelete(symbol: string): void {
    this.deleteTargetSymbol = symbol;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.deleteTargetSymbol = '';
  }

  confirmDeleteAction(): void {
    const symbol = this.deleteTargetSymbol;
    this.deleteDialogOpen = false;
    this.deleteTargetSymbol = '';
    this.deleteHolding(symbol);
  }

  openEditPosition(stock: StockAlert): void {
    this.isSavingHolding = false;
    this.editDialogOpen = true;
    this.editOriginalSymbol = stock.symbol;
    this.editSymbolQuery = stock.symbol;
    this.editSymbolSuggestions = [];
    this.selectedEditSymbol = undefined;
    this.showEditSymbolDropdown = false;
    this.editSymbolMessage = 'Keep this ticker or choose a new stock from the dropdown.';
    this.editForm = {
      symbol: stock.symbol,
      companyName: stock.companyName,
      quantity: stock.quantity,
      averageCost: stock.averageCost,
      watchOnly: stock.watchOnly,
    };
  }

  closeEditPosition(): void {
    this.editDialogOpen = false;
    this.editOriginalSymbol = '';
    this.editSymbolQuery = '';
    this.editSymbolSuggestions = [];
    this.selectedEditSymbol = undefined;
    this.showEditSymbolDropdown = false;
    this.editSymbolMessage = 'Keep this ticker or choose a new stock from the dropdown.';
    if (this.editSymbolSearchHandle) {
      clearTimeout(this.editSymbolSearchHandle);
    }
  }

  searchEditSymbols(): void {
    const query = this.editSymbolQuery.trim();
    this.selectedEditSymbol = undefined;
    this.editForm.symbol = query.toUpperCase();
    this.editForm.companyName = '';
    if (this.editSymbolSearchHandle) {
      clearTimeout(this.editSymbolSearchHandle);
    }

    if (query.toUpperCase() === this.editOriginalSymbol.toUpperCase()) {
      this.editSymbolSuggestions = [];
      this.showEditSymbolDropdown = false;
      this.editForm.companyName = this.stocks.find((stock) => stock.symbol === this.editOriginalSymbol)?.companyName ?? this.editForm.companyName;
      this.editSymbolMessage = 'Current ticker selected.';
      return;
    }

    if (query.length < 2) {
      this.editSymbolSuggestions = [];
      this.showEditSymbolDropdown = false;
      this.editSymbolMessage = 'Type at least 2 characters, then choose a stock from the dropdown.';
      return;
    }

    this.showEditSymbolDropdown = true;
    this.editSymbolMessage = 'Searching Finnhub...';
    this.editSymbolSearchHandle = setTimeout(() => {
      this.marketDashboardService.searchSymbols(this.username, this.password, query).subscribe({
        next: (results) => {
          if (query !== this.editSymbolQuery.trim()) {
            return;
          }

          this.editSymbolSuggestions = results;
          this.editSymbolMessage = results.length
            ? 'Choose one of the dropdown results to change the ticker.'
            : 'No matching stocks found. Try a different ticker or company name.';
        },
        error: () => {
          if (query !== this.editSymbolQuery.trim()) {
            return;
          }

          this.editSymbolSuggestions = [];
          this.editSymbolMessage = 'Could not search stocks. Check backend auth and Finnhub configuration.';
        },
      });
    }, 1000);
  }

  openEditSymbolDropdown(): void {
    this.showEditSymbolDropdown = this.editSymbolQuery.trim().length >= 2
      && this.editSymbolQuery.trim().toUpperCase() !== this.editOriginalSymbol.toUpperCase();
  }

  chooseEditSymbol(symbol: SymbolSearchResult): void {
    if (this.editSymbolSearchHandle) {
      clearTimeout(this.editSymbolSearchHandle);
      this.editSymbolSearchHandle = undefined;
    }
    this.selectedEditSymbol = symbol;
    this.editForm.symbol = symbol.symbol;
    this.editSymbolQuery = symbol.symbol;
    this.editForm.companyName = symbol.name;
    this.showEditSymbolDropdown = false;
    this.editSymbolMessage = `${symbol.name} selected.`;
  }

  saveEditedPosition(): void {
    if (!this.canSaveEdit) {
      this.showSnackbar('Choose an existing ticker from the edit dropdown before saving.', 'error');
      return;
    }

    const originalSymbol = this.editOriginalSymbol;
    const nextSymbol = this.editForm.symbol.toUpperCase();
    const symbolChanged = originalSymbol.toUpperCase() !== nextSymbol;
    this.isSavingHolding = true;
    this.marketDashboardService.saveHolding(this.username, this.password, this.editForm)
      .pipe(
        switchMap(() => symbolChanged
          ? this.marketDashboardService.deleteHolding(this.username, this.password, originalSymbol)
          : of(undefined)
        ),
        finalize(() => (this.isSavingHolding = false)),
      )
      .subscribe({
        next: () => {
          this.showSnackbar(symbolChanged
            ? `${originalSymbol} changed to ${nextSymbol}.`
            : `${nextSymbol} position updated.`);
          this.closeEditPosition();
          this.refreshDashboard();
        },
        error: () => {
          this.showSnackbar('Could not update position. Check ticker, quantity, average cost, and backend auth.', 'error');
        },
      });
  }

  exportPositions(): void {
    this.marketDashboardService.exportPortfolio(this.username, this.password).subscribe({
      next: (csv) => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `portfolio-positions-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.showSnackbar('Portfolio positions exported as CSV.');
      },
      error: () => this.showSnackbar('Could not export portfolio CSV. Check backend auth.', 'error'),
    });
  }

  importPositions(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    this.isImportingPortfolio = true;
    reader.onload = () => {
      const csv = String(reader.result ?? '');
      this.marketDashboardService.importPortfolio(this.username, this.password, csv)
        .pipe(finalize(() => {
          this.isImportingPortfolio = false;
          input.value = '';
        }))
        .subscribe({
          next: (response) => {
            const errorText = response.errors.length ? ` ${response.errors.length} row(s) skipped.` : '';
            this.showSnackbar(`${response.imported} position(s) imported from CSV.${errorText}`);
            this.refreshDashboard();
          },
          error: () => {
            this.showSnackbar('Could not import portfolio CSV. Check the file format and backend auth.', 'error');
          },
        });
    };
    reader.onerror = () => {
      this.isImportingPortfolio = false;
      input.value = '';
      this.showSnackbar('Could not read the selected CSV file.', 'error');
    };
    reader.readAsText(file);
  }

}
