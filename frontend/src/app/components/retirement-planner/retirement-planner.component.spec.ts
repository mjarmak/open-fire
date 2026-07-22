import { TestBed } from '@angular/core/testing';
import { StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { RetirementPlannerComponent } from './retirement-planner.component';

describe('RetirementPlannerComponent', () => {
  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    const stocks = overrides.stocks || [stock()];
    return {
      isLoading: false,
      isLoadingRetirement: false,
      isLoadingStocks: false,
      isLoadingPortfolio: false,
      hasLoadedRetirementSettings: true,
      stocks,
      portfolio: stocks.map((item) => ({
        id: item.id,
        symbol: item.symbol,
        companyName: item.companyName,
        quantity: item.quantity,
        averageCost: item.averageCost,
        watchOnly: item.watchOnly,
      })),
      investingStartDate: '2024-01-01',
      desiredMonthlyIncome: 2000,
      customReturnRate: 12,
      monthlySavings: 4000,
      otherSavings: 100,
      yearlyInflationRate: 3,
      safeWithdrawalRate: 4,
      ...overrides,
    } as MarketDashboardService;
  }

  async function render(state: MarketDashboardService) {
    await TestBed.configureTestingModule({
      imports: [RetirementPlannerComponent],
      providers: [{ provide: MarketDashboardService, useValue: state }],
    }).compileComponents();

    const fixture = TestBed.createComponent(RetirementPlannerComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders all portfolio summary fields with Annualized Return% based on total invested', async () => {
    const element = await render(createState());
    const summary = normalizedText(element.querySelector('.current-assets-card'));

    expect(summary).toContain('Portfolio Summary');
    expect(summary).toContain('$2K');
    expect(summary).toContain('Holdings:1');
    expect(summary).toContain('Initial Deposit:$100');
    expect(summary).toContain('Total Invested:$2K');
    expect(summaryItemText(element, 'Today:')).toContain('$0 (0.0%)');
    expect(summary).not.toContain('Total P&L %:');
    expect(summary).toContain('Annualized Return %: 0.0%');
    expect(summary).toContain('Return Since:2024-01-01');
  });

  it('formats total daily change and total P&L with portfolio-level percentages', async () => {
    const element = await render(createState({
      stocks: [
        stock({
          marketValue: 1200,
          costBasis: 1000,
          dayGainLoss: 20,
          unrealizedGainLoss: 200,
        }),
        stock({
          id: 2,
          symbol: 'MSFT',
          marketValue: 800,
          costBasis: 500,
          dayGainLoss: -5,
          unrealizedGainLoss: 300,
        }),
        stock({
          id: 3,
          symbol: 'WATCH',
          watchOnly: true,
          marketValue: 9999,
          costBasis: 999,
          dayGainLoss: 999,
          unrealizedGainLoss: 999,
        }),
      ],
    }));

    expect(summaryItemText(element, 'Today:')).toContain('+$15 (+0.76%)');
    expect(summaryItemText(element, 'Total P&L:')).toContain('+$500 (+33.33%)');
    expect(normalizedText(element.querySelector('.current-assets-card'))).not.toContain('Total P&L %:');
    expect(normalizedText(element.querySelector('.current-assets-card'))).toContain('$2K');
  });

  it('does not mask retirement content for unrelated dashboard loading', async () => {
    const element = await render(createState({ isLoading: true }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.querySelector('.retirement-content')).not.toBeNull();
  });

  it('shows configuration but withholds position-dependent outputs while positions load', async () => {
    const element = await render(createState({ isLoadingStocks: true }));

    expect(element.textContent).toContain('Loading portfolio projections...');
    expect(element.querySelector('.retirement-content')).not.toBeNull();
    expect(element.querySelector('.config-metric-card')).not.toBeNull();
    expect(element.querySelector('.target-fund-card')).not.toBeNull();
    expect(normalizedText(element.querySelector('.target-fund-card'))).not.toContain('Actual:');
    expect(element.querySelector('.current-assets-card')).not.toBeNull();
    expect(element.querySelector('.portfolio-summary-skeleton')).not.toBeNull();
    expect(normalizedText(element.querySelector('.current-assets-card'))).toBe('Portfolio Summary');
    expect(element.querySelector('.chart-wrapper')).toBeNull();
  });

  it('withholds position-dependent outputs while portfolio metadata loads', async () => {
    const element = await render(createState({ isLoadingPortfolio: true }));

    expect(element.textContent).toContain('Loading portfolio projections...');
    expect(element.querySelector('.config-metric-card')).not.toBeNull();
    expect(element.querySelector('.current-assets-card')).not.toBeNull();
    expect(element.querySelector('.portfolio-summary-skeleton')).not.toBeNull();
    expect(element.querySelector('.chart-wrapper')).toBeNull();
  });

  it('shows a loading indicator when retirement settings are loading', async () => {
    const element = await render(createState({ isLoading: false, isLoadingRetirement: true, hasLoadedRetirementSettings: true }));

    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading retirement plan...');
  });

  it('shows a loading indicator before retirement settings are loaded', async () => {
    const element = await render(createState({ isLoading: false, isLoadingRetirement: false, hasLoadedRetirementSettings: false }));

    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading retirement plan...');
  });

  it('renders all target fund and retirement configuration fields', async () => {
    const element = await render(createState());
    const targetFund = normalizedText(element.querySelector('.target-fund-card'));
    const config = normalizedText(element.querySelector('.config-metric-card'));

    expect(targetFund).toContain('Target Retirement Fund');
    expect(targetFund).toContain('$600K');
    expect(targetFund).toContain('Today, using 4% SWR for $2K/mo');
    expect(targetFund).toContain('Realistic (10%):');
    expect(targetFund).toContain('Actual:');
    expect(targetFund).toContain('Custom (12%):');

    expect(config).toContain('Retirement Configuration');
    expect(config).toContain('Start Date2024-01-01');
    expect(config).toContain('Initial Deposit$100');
    expect(config).toContain('Monthly Add$4K');
    expect(config).toContain('Target Income$2K/mo');
    expect(config).toContain('Inflation3%/yr');
    expect(config).toContain('SWR4%');
    expect(config).toContain('Custom Return12%');
  });

  it('does not use configured initial deposit as the annualized return denominator', async () => {
    const element = await render(createState({
      otherSavings: 1,
      stocks: [stock({ marketValue: 2000, costBasis: 2000 })],
    }));
    const summary = normalizedText(element.querySelector('.current-assets-card'));

    expect(summary).toContain('Initial Deposit:$1');
    expect(summary).toContain('Total Invested:$2K');
    expect(summary).toContain('Annualized Return %: 0.0%');
  });

  it('shows an info note when the current portfolio value is zero', async () => {
    const element = await render(createState({
      stocks: [stock({ marketValue: 0, costBasis: 0, unrealizedGainLoss: 0 })],
    }));
    const note = element.querySelector('.portfolio-empty-note');

    expect(note).not.toBeNull();
    expect(normalizedText(note)).toContain('Add your positions to see your portfolio value.');
    expect(note?.querySelector('.portfolio-empty-note-icon')?.textContent?.trim()).toBe('i');
  });

  it('does not show the empty portfolio note when the current portfolio value is positive', async () => {
    const element = await render(createState());

    expect(element.querySelector('.portfolio-empty-note')).toBeNull();
  });

  it('keeps portfolio metrics available for foreign stocks with partial indicators', async () => {
    const element = await render(createState({
      stocks: [stock({
        symbol: '3GP',
        companyName: 'Xiaomi',
        peRatio: null,
        beta: null,
        realizedVolatilityPercent: null,
        drawdownPercent: null,
        marketValue: 40,
      })],
    }));

    expect(element.querySelector('.portfolio-price-unavailable')).toBeNull();
    expect(normalizedText(element.querySelector('.current-assets-card'))).toContain('$40');
    expect(element.querySelector('.chart-wrapper')).not.toBeNull();
  });

  it('hides portfolio totals when an owned position price is unavailable', async () => {
    const element = await render(createState({
      stocks: [stock({ symbol: 'AAPL', latestPrice: null, marketValue: null })],
    }));

    const unavailable = element.querySelector('.portfolio-price-unavailable');
    expect(unavailable).not.toBeNull();
    expect(normalizedText(unavailable)).toContain('Prices unavailable for AAPL');
    expect(normalizedText(element.querySelector('.current-assets-card'))).not.toContain('$2K');
    expect(element.querySelector('.chart-wrapper')).toBeNull();
    expect(element.textContent).toContain('Portfolio projections are unavailable');
  });

  function normalizedText(element: Element | null): string {
    return (element?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function summaryItemText(element: HTMLElement, label: string): string {
    const item = Array.from(element.querySelectorAll('.current-assets-card .subtext-item'))
      .find((candidate) => normalizedText(candidate).startsWith(label));
    return normalizedText(item || null);
  }

  function stock(overrides: Partial<StockAlert> = {}): StockAlert {
    return {
      id: 1,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      positionType: 'Technology',
      quantity: 10,
      averageCost: 200,
      latestPrice: 200,
      marketCap: 3_000_000_000_000,
      peRatio: 28,
      beta: 1.2,
      realizedVolatilityPercent: 22,
      drawdownPercent: 8,
      fearScore: 42,
      marketValue: 2000,
      costBasis: 2000,
      dayGainLoss: 0,
      dayGainLossPercent: 0,
      unrealizedGainLoss: 0,
      unrealizedGainLossPercent: 0,
      thirtyDayChangePercent: 5,
      watchOnly: false,
      alert: false,
      reason: 'No watched stock alerts fired under current thresholds.',
      ...overrides,
    };
  }
});
