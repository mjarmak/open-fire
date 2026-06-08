import { Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
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
import { StockRiskPanelComponent } from './components/stock-risk-panel/stock-risk-panel.component';
import { StockLookupResultRowComponent } from './components/stock-lookup-result-row/stock-lookup-result-row.component';
import { TelegramDialogComponent } from './components/telegram-dialog/telegram-dialog.component';
import { TooltipBodyComponent } from './components/tooltip-body/tooltip-body.component';
import { dialogBackdropAnimation, dialogPanelAnimation } from './components/dialog.animations';

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
    StockLookupResultRowComponent,
    StockRiskPanelComponent,
    TelegramDialogComponent,
    TooltipBodyComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
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
  private stockLookupSearchHandle?: ReturnType<typeof setTimeout>;
  private stockLookupInputSelectHandle?: ReturnType<typeof setTimeout>;
  private feedbackInputSelectHandle?: ReturnType<typeof setTimeout>;
  private snackbarHandle?: ReturnType<typeof setTimeout>;
  private dashboardLoadToken = 0;
  private stockLookupInputElement?: ElementRef<HTMLInputElement>;
  private stockLookupInputSelectionPending = false;
  private feedbackInputElement?: ElementRef<HTMLTextAreaElement>;
  private feedbackInputSelectionPending = false;

  constructor(public readonly marketDashboardService: MarketDashboardService) {}

  @ViewChild('stockLookupQueryInput')
  private set stockLookupQueryInput(input: ElementRef<HTMLInputElement> | undefined) {
    this.stockLookupInputElement = input;
    if (input && this.marketDashboardService.stockLookupDialogOpen && this.stockLookupInputSelectionPending) {
      this.queueStockLookupInputSelection();
    }
  }

  @ViewChild('feedbackMessageInput')
  private set feedbackMessageInput(input: ElementRef<HTMLTextAreaElement> | undefined) {
    this.feedbackInputElement = input;
    if (input && this.feedbackDialogOpen && this.feedbackInputSelectionPending) {
      this.queueFeedbackInputSelection();
    }
  }

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
  get editOriginalId(): number | null { return this.marketDashboardService.editOriginalId; }
  set editOriginalId(value: number | null) { this.marketDashboardService.editOriginalId = value; }
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
  get deleteTargetId(): number | null { return this.marketDashboardService.deleteTargetId; }
  set deleteTargetId(value: number | null) { this.marketDashboardService.deleteTargetId = value; }
  get deleteTargetSymbol(): string { return this.marketDashboardService.deleteTargetSymbol; }
  set deleteTargetSymbol(value: string) { this.marketDashboardService.deleteTargetSymbol = value; }
  get alertsDialogOpen(): boolean { return this.marketDashboardService.alertsDialogOpen; }
  set alertsDialogOpen(value: boolean) { this.marketDashboardService.alertsDialogOpen = value; }
  get telegramDialogOpen(): boolean { return this.marketDashboardService.telegramDialogOpen; }
  set telegramDialogOpen(value: boolean) { this.marketDashboardService.telegramDialogOpen = value; }
  get telegramChatId(): string { return this.marketDashboardService.telegramChatId; }
  set telegramChatId(value: string) { this.marketDashboardService.telegramChatId = value; }
  get telegramAlertDays(): string[] { return this.marketDashboardService.telegramAlertDays; }
  set telegramAlertDays(value: string[]) { this.marketDashboardService.telegramAlertDays = value; }
  get draftTelegramAlertDays(): string[] { return this.marketDashboardService.draftTelegramAlertDays; }
  set draftTelegramAlertDays(value: string[]) { this.marketDashboardService.draftTelegramAlertDays = value; }
  get isLoadingTelegram(): boolean { return this.marketDashboardService.isLoadingTelegram; }
  set isLoadingTelegram(value: boolean) { this.marketDashboardService.isLoadingTelegram = value; }
  get isSavingTelegram(): boolean { return this.marketDashboardService.isSavingTelegram; }
  set isSavingTelegram(value: boolean) { this.marketDashboardService.isSavingTelegram = value; }
  get feedbackDialogOpen(): boolean { return this.marketDashboardService.feedbackDialogOpen; }
  set feedbackDialogOpen(value: boolean) { this.marketDashboardService.feedbackDialogOpen = value; }
  get feedbackMessage(): string { return this.marketDashboardService.feedbackMessage; }
  set feedbackMessage(value: string) { this.marketDashboardService.feedbackMessage = value; }
  get feedbackMaxLength(): number { return this.marketDashboardService.feedbackMaxLength; }
  get isSendingFeedback(): boolean { return this.marketDashboardService.isSendingFeedback; }
  set isSendingFeedback(value: boolean) { this.marketDashboardService.isSendingFeedback = value; }
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
  get dcaReminderDays(): string[] { return this.marketDashboardService.dcaReminderDays; }
  set dcaReminderDays(value: string[]) { this.marketDashboardService.dcaReminderDays = value; }
  get draftTelegramDcaEnabled(): boolean { return this.marketDashboardService.draftTelegramDcaEnabled; }
  set draftTelegramDcaEnabled(value: boolean) { this.marketDashboardService.draftTelegramDcaEnabled = value; }
  get draftDcaReminderNote(): string { return this.marketDashboardService.draftDcaReminderNote; }
  set draftDcaReminderNote(value: string) { this.marketDashboardService.draftDcaReminderNote = value; }
  get draftDcaReminderDays(): string[] { return this.marketDashboardService.draftDcaReminderDays; }
  set draftDcaReminderDays(value: string[]) { this.marketDashboardService.draftDcaReminderDays = value; }
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
    if (this.stockLookupSearchHandle) {
      clearTimeout(this.stockLookupSearchHandle);
    }
    if (this.stockLookupInputSelectHandle) {
      clearTimeout(this.stockLookupInputSelectHandle);
    }
    if (this.feedbackInputSelectHandle) {
      clearTimeout(this.feedbackInputSelectHandle);
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
    this.marketDashboardService.isLoadingIndicators = true;
    this.marketDashboardService.isLoadingStocks = true;
    this.marketDashboardService.isLoadingPortfolio = true;
    this.marketDashboardService.isLoadingNotification = true;
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
    const completeSectionCall = (
      flag: 'isLoadingIndicators' | 'isLoadingStocks' | 'isLoadingPortfolio' | 'isLoadingNotification',
    ) => {
      if (loadToken === this.dashboardLoadToken) {
        this.marketDashboardService[flag] = false;
      }
      completeCall();
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
      .pipe(finalize(() => completeSectionCall('isLoadingIndicators')))
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
      .pipe(finalize(() => completeSectionCall('isLoadingStocks')))
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
      .pipe(finalize(() => completeSectionCall('isLoadingPortfolio')))
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
      .pipe(finalize(() => completeSectionCall('isLoadingNotification')))
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
    this.marketDashboardService.isLoadingIndicators = false;
    this.marketDashboardService.isLoadingStocks = false;
    this.marketDashboardService.isLoadingPortfolio = false;
    this.marketDashboardService.isLoadingNotification = false;
    this.isLoggedIn = false;
    this.username = '';
    this.password = '';
    this.clearLoginCredentials();
    this.hasLoadedDcaSettings = false;
    this.telegramDcaEnabled = false;
    this.dcaReminderNote = '';
    this.dcaReminderDays = [...this.marketDashboardService.defaultDcaReminderDays];
    this.draftTelegramDcaEnabled = false;
    this.draftDcaReminderNote = '';
    this.draftDcaReminderDays = [...this.marketDashboardService.defaultDcaReminderDays];
    this.telegramAlertDays = [...this.marketDashboardService.defaultTelegramAlertDays];
    this.draftTelegramAlertDays = [...this.marketDashboardService.defaultTelegramAlertDays];
    this.isLoadingTelegram = false;
    this.isSavingTelegram = false;
    this.dcaDialogOpen = false;
    this.dcaSuggestionDialogOpen = false;
    this.alertsDialogOpen = false;
    this.feedbackDialogOpen = false;
    this.feedbackMessage = '';
    this.isSendingFeedback = false;
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
    this.isLoadingTelegram = true;
    this.marketDashboardService.telegramSettings(this.username, this.password)
      .pipe(finalize(() => (this.isLoadingTelegram = false)))
      .subscribe({
      next: (settings) => {
        this.telegramChatId = settings.chatId;
        this.telegramAlertDays = settings.alertDays ?? [...this.marketDashboardService.defaultTelegramAlertDays];
        this.draftTelegramAlertDays = [...this.telegramAlertDays];
      },
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

  searchHeaderStock(): void {
    if (!this.isLoggedIn) {
      this.showSnackbar('Login before searching position risks.', 'error');
      return;
    }

    this.marketDashboardService.stockLookupDialogOpen = true;
    this.requestStockLookupInputSelection();
    this.marketDashboardService.stockLookupMessage = this.marketDashboardService.stockLookupQuery.trim().length >= 2
      ? this.marketDashboardService.stockLookupMessage
      : 'Type at least 2 characters to search stocks, crypto, or currencies.';
    if (this.marketDashboardService.stockLookupQuery.trim().length >= 2) {
      this.scheduleStockLookupSearch();
    }
  }

  onStockLookupQueryChange(event: Event): void {
    this.marketDashboardService.stockLookupQuery = (event.target as HTMLInputElement).value;
    this.clearStockLookupResultsForQueryEdit(this.marketDashboardService.stockLookupQuery);
    this.scheduleStockLookupSearch();
  }

  onStockLookupQueryKeydown(event: KeyboardEvent): void {
    if (this.hasStockLookupResults() && this.isStockLookupQueryEditingKey(event)) {
      this.clearStockLookupResultsForQueryEdit(this.marketDashboardService.stockLookupQuery);
    }
  }

  runStockLookupSearch(): void {
    if (this.stockLookupSearchHandle) {
      clearTimeout(this.stockLookupSearchHandle);
      this.stockLookupSearchHandle = undefined;
    }

    const query = this.marketDashboardService.stockLookupQuery.trim();
    if (query.length < 2) {
      this.marketDashboardService.stockLookupSuggestions = [];
      this.marketDashboardService.stockLookupRisks = {};
      this.marketDashboardService.stockLookupMessage = 'Type at least 2 characters to search stocks, crypto, or currencies.';
      return;
    }

    this.marketDashboardService.isSearchingStockLookup = true;
    this.marketDashboardService.stockLookupMessage = 'Searching...';
    this.marketDashboardService.searchSymbols(this.username, this.password, query, false, true)
      .pipe(finalize(() => (this.marketDashboardService.isSearchingStockLookup = false)))
      .subscribe({
        next: (results) => {
          if (query !== this.marketDashboardService.stockLookupQuery.trim()) {
            return;
          }

          this.marketDashboardService.stockLookupSuggestions = results;
          this.marketDashboardService.stockLookupRisks = {};
          this.marketDashboardService.stockLookupMessage = results.length
            ? 'Choose a result to add it to your portfolio.'
            : 'No matching symbols found. Try a different ticker, name, or pair.';
        },
        error: () => {
          if (query !== this.marketDashboardService.stockLookupQuery.trim()) {
            return;
          }

          this.marketDashboardService.stockLookupSuggestions = [];
          this.marketDashboardService.stockLookupMessage = 'Could not search symbols. Check backend auth and Finnhub configuration.';
        },
      });
  }

  closeStockLookupDialog(): void {
    this.marketDashboardService.stockLookupDialogOpen = false;
    this.marketDashboardService.isSearchingStockLookup = false;
    if (this.stockLookupSearchHandle) {
      clearTimeout(this.stockLookupSearchHandle);
      this.stockLookupSearchHandle = undefined;
    }
    if (this.stockLookupInputSelectHandle) {
      clearTimeout(this.stockLookupInputSelectHandle);
      this.stockLookupInputSelectHandle = undefined;
    }
    this.stockLookupInputSelectionPending = false;
  }

  private requestStockLookupInputSelection(): void {
    this.stockLookupInputSelectionPending = true;
    this.queueStockLookupInputSelection();
  }

  private queueStockLookupInputSelection(): void {
    if (!this.stockLookupInputSelectionPending) {
      return;
    }

    if (this.stockLookupInputSelectHandle) {
      clearTimeout(this.stockLookupInputSelectHandle);
    }

    this.stockLookupInputSelectHandle = setTimeout(() => {
      this.stockLookupInputSelectHandle = undefined;
      if (!this.marketDashboardService.stockLookupDialogOpen || !this.stockLookupInputSelectionPending) {
        return;
      }

      const input = this.stockLookupInputElement?.nativeElement;
      if (!input) {
        return;
      }

      this.stockLookupInputSelectionPending = false;
      input.focus();
      input.select();
    }, 0);
  }

  private scheduleStockLookupSearch(): void {
    if (this.stockLookupSearchHandle) {
      clearTimeout(this.stockLookupSearchHandle);
    }

    this.stockLookupSearchHandle = setTimeout(() => this.runStockLookupSearch(), 500);
  }

  private clearStockLookupResultsForQueryEdit(query: string): void {
    this.marketDashboardService.stockLookupSuggestions = [];
    this.marketDashboardService.stockLookupRisks = {};
    this.marketDashboardService.stockLookupResult = undefined;
    this.marketDashboardService.selectedStockLookup = undefined;
    this.marketDashboardService.stockLookupMessage = query.trim().length >= 2
      ? 'Searching...'
      : 'Type at least 2 characters to search stocks, crypto, or currencies.';
  }

  private hasStockLookupResults(): boolean {
    return this.marketDashboardService.stockLookupSuggestions.length > 0
      || Object.keys(this.marketDashboardService.stockLookupRisks).length > 0
      || this.marketDashboardService.stockLookupResult !== undefined
      || this.marketDashboardService.selectedStockLookup !== undefined;
  }

  private isStockLookupQueryEditingKey(event: KeyboardEvent): boolean {
    if (event.isComposing) {
      return false;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      return true;
    }

    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === 'v' || key === 'x')) {
      return true;
    }

    return event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  addStockLookupResult(result: SymbolSearchResult): void {
    this.closeStockLookupDialog();
    this.openAddPosition();
    this.chooseSymbol(result);
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

  openFeedbackDialog(): void {
    if (!this.isLoggedIn) {
      this.openLoginDialog();
      this.showSnackbar('Login before sending feedback.', 'error');
      return;
    }

    this.feedbackMessage = '';
    this.feedbackDialogOpen = true;
    this.requestFeedbackInputSelection();
  }

  closeFeedbackDialog(): void {
    this.feedbackDialogOpen = false;
    if (this.feedbackInputSelectHandle) {
      clearTimeout(this.feedbackInputSelectHandle);
      this.feedbackInputSelectHandle = undefined;
    }
    this.feedbackInputSelectionPending = false;
  }

  private requestFeedbackInputSelection(): void {
    this.feedbackInputSelectionPending = true;
    this.queueFeedbackInputSelection();
  }

  private queueFeedbackInputSelection(): void {
    if (!this.feedbackInputSelectionPending) {
      return;
    }

    if (this.feedbackInputSelectHandle) {
      clearTimeout(this.feedbackInputSelectHandle);
    }

    this.feedbackInputSelectHandle = setTimeout(() => {
      this.feedbackInputSelectHandle = undefined;
      if (!this.feedbackDialogOpen || !this.feedbackInputSelectionPending) {
        return;
      }

      const input = this.feedbackInputElement?.nativeElement;
      if (!input) {
        return;
      }

      this.feedbackInputSelectionPending = false;
      input.focus();
      input.select();
    }, 0);
  }

  sendFeedback(): void {
    if (!this.isLoggedIn) {
      return;
    }

    const message = this.feedbackMessage.trim();
    if (!message) {
      this.showSnackbar('Enter a feedback message.', 'error');
      return;
    }
    if (message.length > this.feedbackMaxLength) {
      this.showSnackbar(`Feedback must be ${this.feedbackMaxLength} characters or less.`, 'error');
      return;
    }

    this.isSendingFeedback = true;
    this.marketDashboardService.submitFeedback(this.username, this.password, message)
      .pipe(finalize(() => (this.isSendingFeedback = false)))
      .subscribe({
        next: (response) => {
          this.showSnackbar(response.message);
          this.closeFeedbackDialog();
        },
        error: () => this.showSnackbar('Could not send feedback.', 'error'),
      });
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
      reminderDays: this.draftDcaReminderDays,
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
    this.dcaReminderDays = settings.reminderDays ?? [...this.marketDashboardService.defaultDcaReminderDays];
  }

  private populateDcaDraft(): void {
    this.draftTelegramDcaEnabled = this.telegramDcaEnabled;
    this.draftDcaReminderNote = this.dcaReminderNote;
    this.draftDcaReminderDays = [...this.dcaReminderDays];
  }

  saveTelegramChatId(): void {
    const chatId = this.telegramChatId.trim();
    if (!chatId) {
      this.showSnackbar('Enter your Telegram chat ID.', 'error');
      return;
    }

    this.isSavingTelegram = true;
    this.marketDashboardService.saveTelegramSettings(this.username, this.password, chatId, this.draftTelegramAlertDays)
      .pipe(finalize(() => (this.isSavingTelegram = false)))
      .subscribe({
        next: (settings) => {
          this.telegramChatId = settings.chatId;
          this.telegramAlertDays = settings.alertDays ?? [...this.marketDashboardService.defaultTelegramAlertDays];
          this.draftTelegramAlertDays = [...this.telegramAlertDays];
          this.showSnackbar('Telegram settings saved.');
          this.closeTelegramDialog();
          this.refreshDashboard();
        },
        error: () => this.showSnackbar('Could not save Telegram settings.', 'error'),
      });
  }

  sendTelegramTest(): void {
    const chatId = this.telegramChatId.trim();
    if (!chatId) {
      this.showSnackbar('Enter your Telegram chat ID before testing.', 'error');
      return;
    }

    this.isSavingTelegram = true;
    this.marketDashboardService.saveTelegramSettings(this.username, this.password, chatId, this.draftTelegramAlertDays)
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
      this.symbolMessage = 'Type at least 2 characters, then choose a stock, crypto, or currency from the dropdown.';
      return;
    }

    this.showSymbolDropdown = true;
    this.symbolMessage = 'Searching...';
    this.symbolSearchHandle = setTimeout(() => {
      this.marketDashboardService.searchSymbols(this.username, this.password, query).subscribe({
        next: (results) => {
          if (query !== this.symbolQuery.trim()) {
            return;
          }

          this.symbolSuggestions = results;
          const exactMatch = results.find((result) => result.symbol.toUpperCase() === query.toUpperCase());
          if (exactMatch) {
            this.holdingForm.symbol = exactMatch.symbol;
            this.holdingForm.companyName = exactMatch.name;
          }
          this.symbolMessage = results.length
            ? 'Choose one of the dropdown results to link this position.'
            : 'No matching symbols found. Try a different ticker, name, or pair.';
        },
        error: () => {
          if (query !== this.symbolQuery.trim()) {
            return;
          }

          this.symbolSuggestions = [];
          this.symbolMessage = 'Could not search symbols. Check backend auth and Finnhub configuration.';
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
      this.showSnackbar('Choose an existing stock, crypto, or currency from the dropdown before adding it.', 'error');
      return;
    }

    this.isSavingHolding = true;
    this.marketDashboardService.saveHolding(this.username, this.password, this.holdingForm)
      .pipe(finalize(() => (this.isSavingHolding = false)))
      .subscribe({
        next: (savedHolding) => {
          this.applyLocalHoldingUpsert(savedHolding, this.selectedSymbol?.indicators ?? null);
          this.showSnackbar(`${savedHolding.symbol} saved to portfolio.`);
          this.closeAddPosition();
        },
        error: () => {
          this.showSnackbar('Could not save holding. Check symbol, quantity, average cost, and backend auth.', 'error');
        },
      });
  }

  private resetAddForm(): void {
    this.holdingForm = { id: null, symbol: '', companyName: '', quantity: 0, averageCost: 0, watchOnly: false };
    this.symbolQuery = '';
    this.symbolSuggestions = [];
    this.selectedSymbol = undefined;
    this.showSymbolDropdown = false;
    this.symbolMessage = 'Start typing and choose a stock, crypto, or currency from the dropdown.';
    if (this.symbolSearchHandle) {
      clearTimeout(this.symbolSearchHandle);
    }
  }

  deleteHolding(holdingId: number, symbol: string): void {
    this.marketDashboardService.deleteHolding(this.username, this.password, holdingId).subscribe({
      next: () => {
        this.applyLocalHoldingDelete(holdingId);
        this.showSnackbar(`${symbol} removed from portfolio.`);
      },
      error: () => this.showSnackbar(`Could not remove ${symbol}.`, 'error'),
    });
  }

  confirmDelete(stock: StockAlert): void {
    this.deleteTargetId = stock.id;
    this.deleteTargetSymbol = stock.symbol;
    this.deleteDialogOpen = true;
  }

  cancelDelete(): void {
    this.deleteDialogOpen = false;
    this.deleteTargetId = null;
    this.deleteTargetSymbol = '';
  }

  confirmDeleteAction(): void {
    const id = this.deleteTargetId;
    const symbol = this.deleteTargetSymbol;
    this.deleteDialogOpen = false;
    this.deleteTargetId = null;
    this.deleteTargetSymbol = '';
    if (id === null) {
      this.showSnackbar('Could not remove position. Missing row id.', 'error');
      return;
    }
    this.deleteHolding(id, symbol);
  }

  openEditPosition(stock: StockAlert): void {
    this.isSavingHolding = false;
    this.editDialogOpen = true;
    this.editOriginalId = stock.id;
    this.editOriginalSymbol = stock.symbol;
    this.editSymbolQuery = stock.symbol;
    this.editSymbolSuggestions = [];
    this.selectedEditSymbol = undefined;
    this.showEditSymbolDropdown = false;
    this.editSymbolMessage = 'Keep this symbol or choose a new stock, crypto, or currency from the dropdown.';
    this.editForm = {
      id: stock.id,
      symbol: stock.symbol,
      companyName: stock.companyName,
      quantity: stock.quantity,
      averageCost: stock.averageCost,
      watchOnly: stock.watchOnly,
    };
  }

  closeEditPosition(): void {
    this.editDialogOpen = false;
    this.editOriginalId = null;
    this.editOriginalSymbol = '';
    this.editSymbolQuery = '';
    this.editSymbolSuggestions = [];
    this.selectedEditSymbol = undefined;
    this.showEditSymbolDropdown = false;
    this.editSymbolMessage = 'Keep this symbol or choose a new stock, crypto, or currency from the dropdown.';
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
      this.editSymbolMessage = 'Current symbol selected.';
      return;
    }

    if (query.length < 2) {
      this.editSymbolSuggestions = [];
      this.showEditSymbolDropdown = false;
      this.editSymbolMessage = 'Type at least 2 characters, then choose a stock, crypto, or currency from the dropdown.';
      return;
    }

    this.showEditSymbolDropdown = true;
    this.editSymbolMessage = 'Searching...';
    this.editSymbolSearchHandle = setTimeout(() => {
      this.marketDashboardService.searchSymbols(this.username, this.password, query).subscribe({
        next: (results) => {
          if (query !== this.editSymbolQuery.trim()) {
            return;
          }

          this.editSymbolSuggestions = results;
          this.editSymbolMessage = results.length
            ? 'Choose one of the dropdown results to change the symbol.'
            : 'No matching symbols found. Try a different ticker, name, or pair.';
        },
        error: () => {
          if (query !== this.editSymbolQuery.trim()) {
            return;
          }

          this.editSymbolSuggestions = [];
          this.editSymbolMessage = 'Could not search symbols. Check backend auth and Finnhub configuration.';
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
      this.showSnackbar('Choose an existing symbol from the edit dropdown before saving.', 'error');
      return;
    }

    const originalSymbol = this.editOriginalSymbol;
    const originalId = this.editOriginalId;
    const nextSymbol = this.editForm.symbol.toUpperCase();
    const symbolChanged = originalSymbol.toUpperCase() !== nextSymbol;
    if (originalId === null) {
      this.showSnackbar('Could not update position. Missing row id.', 'error');
      return;
    }
    this.isSavingHolding = true;
    this.marketDashboardService.updateHolding(this.username, this.password, originalId, this.editForm)
      .pipe(finalize(() => (this.isSavingHolding = false)))
      .subscribe({
        next: (savedHolding) => {
          this.applyLocalHoldingUpsert(savedHolding, this.selectedEditSymbol?.indicators ?? null, originalId);
          this.showSnackbar(symbolChanged
            ? `${originalSymbol} changed to ${nextSymbol}.`
            : `${nextSymbol} position updated.`);
          this.closeEditPosition();
        },
        error: () => {
          this.showSnackbar('Could not update position. Check ticker, quantity, average cost, and backend auth.', 'error');
        },
      });
  }

  private applyLocalHoldingUpsert(
    holding: PortfolioHolding,
    indicatorSnapshot: StockAlert | null = null,
    previousHoldingId: number | null = holding.id,
  ): void {
    const portfolio = this.upsertHolding(this.dashboard.portfolio, holding, previousHoldingId);
    const previousStock = this.findExistingStockForHolding(holding, previousHoldingId);
    const stock = this.stockAlertFromHolding(holding, indicatorSnapshot ?? previousStock ?? null);
    const stocks = this.upsertStock(this.dashboard.stocks, stock, previousHoldingId);

    this.dashboard = {
      ...this.dashboard,
      asOf: new Date().toISOString(),
      portfolio,
      stocks,
      dailyReport: this.composeDailyReport(this.indicators, stocks),
    };
  }

  private applyLocalHoldingDelete(holdingId: number): void {
    const portfolio = this.dashboard.portfolio.filter((holding) => holding.id !== holdingId);
    const stocks = this.dashboard.stocks.filter((stock) => stock.id !== holdingId);
    this.dashboard = {
      ...this.dashboard,
      asOf: new Date().toISOString(),
      portfolio,
      stocks,
      dailyReport: this.composeDailyReport(this.indicators, stocks),
    };
  }

  private upsertHolding(
    holdings: PortfolioHolding[],
    nextHolding: PortfolioHolding,
    previousHoldingId: number | null,
  ): PortfolioHolding[] {
    const filtered = holdings.filter((holding) =>
      (previousHoldingId === null || holding.id !== previousHoldingId)
        && (nextHolding.id === null || holding.id !== nextHolding.id),
    );
    return [...filtered, nextHolding];
  }

  private upsertStock(
    stocks: StockAlert[],
    nextStock: StockAlert,
    previousHoldingId: number | null,
  ): StockAlert[] {
    const filtered = stocks.filter((stock) =>
      (previousHoldingId === null || stock.id !== previousHoldingId)
        && (nextStock.id === null || stock.id !== nextStock.id),
    );
    return [...filtered, nextStock];
  }

  private findExistingStockForHolding(holding: PortfolioHolding, previousHoldingId: number | null): StockAlert | null {
    return this.dashboard.stocks.find((stock) => stock.id !== null && stock.id === previousHoldingId)
      ?? this.dashboard.stocks.find((stock) => holding.id !== null && stock.id === holding.id)
      ?? this.dashboard.stocks.find((stock) => stock.symbol.toUpperCase() === holding.symbol.toUpperCase())
      ?? null;
  }

  private stockAlertFromHolding(holding: PortfolioHolding, source: StockAlert | null): StockAlert {
    const latestPrice = source?.latestPrice ?? null;
    const costBasis = holding.watchOnly ? null : this.roundMoney(holding.quantity * holding.averageCost);
    const marketValue = holding.watchOnly || latestPrice === null ? null : this.roundMoney(holding.quantity * latestPrice);
    const unrealizedGainLoss = marketValue === null || costBasis === null ? null : this.roundMoney(marketValue - costBasis);
    const unrealizedGainLossPercent = unrealizedGainLoss === null || costBasis === null || costBasis === 0
      ? null
      : this.roundPercent((unrealizedGainLoss / costBasis) * 100);
    const perShareDayGainLoss = this.perShareDayGainLoss(source);
    const dayGainLoss = perShareDayGainLoss === null
      ? null
      : this.roundMoney(holding.watchOnly ? perShareDayGainLoss : perShareDayGainLoss * holding.quantity);

    return {
      id: holding.id,
      symbol: holding.symbol,
      companyName: holding.companyName,
      positionType: source?.positionType ?? 'Unknown',
      quantity: holding.quantity,
      averageCost: holding.averageCost,
      latestPrice,
      marketCap: source?.marketCap ?? null,
      peRatio: source?.peRatio ?? null,
      beta: source?.beta ?? null,
      realizedVolatilityPercent: source?.realizedVolatilityPercent ?? null,
      drawdownPercent: source?.drawdownPercent ?? null,
      fearScore: source?.fearScore ?? null,
      marketValue,
      costBasis,
      dayGainLoss,
      dayGainLossPercent: source?.dayGainLossPercent ?? null,
      unrealizedGainLoss,
      unrealizedGainLossPercent,
      thirtyDayChangePercent: source?.thirtyDayChangePercent ?? null,
      watchOnly: holding.watchOnly,
      alert: source?.alert ?? false,
      reason: source?.reason ?? 'No watched position alerts fired under current thresholds.',
    };
  }

  private perShareDayGainLoss(source: StockAlert | null): number | null {
    if (source?.dayGainLoss === null || source?.dayGainLoss === undefined) {
      return null;
    }

    if (source.watchOnly || source.quantity === 0) {
      return source.dayGainLoss;
    }

    return source.dayGainLoss / source.quantity;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private roundPercent(value: number): number {
    return Math.round(value * 10) / 10;
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
