import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { IndicatorSnapshot, StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { PortfolioBoardComponent } from './portfolio-board.component';

describe('PortfolioBoardComponent', () => {
  function stock(overrides: Partial<StockAlert> = {}): StockAlert {
    return {
      id: 1,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      positionType: 'Technology',
      quantity: 4,
      averageCost: 20,
      latestPrice: 25,
      marketCap: 1_000_000_000,
      peRatio: 20,
      beta: 1.1,
      realizedVolatilityPercent: 18,
      drawdownPercent: 4,
      fearScore: 35,
      marketValue: null,
      costBasis: null,
      dayGainLoss: 10,
      dayGainLossPercent: 2.5,
      unrealizedGainLoss: 20,
      unrealizedGainLossPercent: 25,
      thirtyDayChangePercent: 11,
      watchOnly: false,
      alert: false,
      reason: 'No alert',
      ...overrides,
    };
  }

  function indicator(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
    return {
      id: 'credit',
      name: 'Credit Market',
      category: 'Credit',
      value: 0.74,
      unit: 'spread %',
      change: -0.15,
      status: 'watch',
      source: 'Mock',
      lastUpdated: new Date().toISOString(),
      description: 'Credit stress proxy.',
      ...overrides,
    };
  }

  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoading: false,
      isLoadingStocks: false,
      isImportingPortfolio: false,
      username: 'demo',
      password: 'password123',
      stocks: [],
      indicators: [],
      ensureGlobalIndicatorChart: jasmine.createSpy('ensureGlobalIndicatorChart'),
      getGlobalIndicatorChartRange: jasmine.createSpy('getGlobalIndicatorChartRange').and.returnValue('1m'),
      globalIndicatorChartPoints: jasmine.createSpy('globalIndicatorChartPoints').and.callFake((indicatorId: string) => {
        if (indicatorId === 'vix') {
          return [
            { timestamp: '2026-05-01T00:00:00Z', value: 16.1 },
            { timestamp: '2026-06-01T00:00:00Z', value: 15.32 },
          ];
        }
        return [
          { timestamp: '2026-05-01T00:00:00Z', value: 0.82 },
          { timestamp: '2026-06-01T00:00:00Z', value: 0.74 },
        ];
      }),
      isGlobalIndicatorChartLoading: jasmine.createSpy('isGlobalIndicatorChartLoading').and.returnValue(false),
      setGlobalIndicatorChartRange: jasmine.createSpy('setGlobalIndicatorChartRange'),
      fetchStockHistory: jasmine.createSpy('fetchStockHistory').and.returnValue(of({
        id: 'AAPL',
        range: '1m',
        points: [
          { timestamp: '2026-05-01T00:00:00Z', value: 22 },
          { timestamp: '2026-06-01T00:00:00Z', value: 25 },
        ],
      })),
      ...overrides,
    } as MarketDashboardService;
  }

  async function render(state: MarketDashboardService): Promise<{
    fixture: ComponentFixture<PortfolioBoardComponent>;
    element: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [PortfolioBoardComponent],
      providers: [
        { provide: MarketDashboardService, useValue: state },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PortfolioBoardComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  function textContent(element: Element | null): string {
    return element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  function positionRow(element: HTMLElement, symbol: string): HTMLElement {
    const rows = Array.from(element.querySelectorAll<HTMLElement>('.stock-row'));
    const row = rows.find((candidate) => textContent(candidate.querySelector('.ticket-type-indicator')) === symbol);
    if (!row) {
      throw new Error(`Could not find position row for ${symbol}`);
    }
    return row;
  }

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('shows loading indicator while loading portfolio data', async () => {
    const { element } = await render(createState({ isLoadingStocks: true, stocks: [] }));
    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading portfolio...');
  });

  it('renders empty portfolio description when loaded with no stocks', async () => {
    const { element } = await render(createState({ isLoading: false, stocks: [] }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.textContent).toContain('Add a portfolio position above, then configure Finnhub to enrich it with live market data.');
  });

  it('does not show empty-state description while loading even with no stocks', async () => {
    const { element } = await render(createState({ isLoadingStocks: true, stocks: [] }));
    expect(element.textContent).not.toContain('Add a portfolio position above');
  });

  it('does not mask positions for unrelated dashboard loading', async () => {
    const { element } = await render(createState({ isLoading: true, isLoadingStocks: false, stocks: [] }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.textContent).toContain('Add a portfolio position above');
  });

  it('shows P/E in the position type category tooltip only when available', async () => {
    const { element } = await render(createState({
      stocks: [
        stock({ symbol: 'AAPL', companyName: 'Apple Inc.', positionType: 'Tech', peRatio: 29.12 }),
        stock({ id: 2, symbol: 'MSFT', companyName: 'Microsoft Corp.', positionType: 'Tech', peRatio: null }),
      ],
    }));

    const category = element.querySelector<HTMLElement>('.category-tooltip');
    const tooltip = category?.getAttribute('data-tooltip') || '';

    expect(category).not.toBeNull();
    expect(tooltip).toContain('AAPL - Apple Inc.');
    expect(tooltip).toContain('P/E: 29.12');
    expect(tooltip).toContain('MSFT - Microsoft Corp.');
    expect(tooltip).not.toContain('MSFT - Microsoft Corp.\nx4 | Current: $100.00 | P/E');
    expect(tooltip).not.toContain('P/E: -');
  });

  it('renders both global risk charts below the pie chart and above positions', async () => {
    const state = createState({
      stocks: [stock()],
      indicators: [
        indicator({ id: 'vix', name: 'Fear Index / VIX', category: 'Volatility', value: 15.32, unit: 'index points' }),
        indicator(),
      ],
    });
    const { element } = await render(state);
    const piePanel = element.querySelector<HTMLElement>('.position-type-panel');
    const globalCharts = Array.from(element.querySelectorAll<HTMLElement>('.global-risk-chart-panel'));
    const vixChart = globalCharts.find((chart) => chart.getAttribute('aria-label')?.includes('Fear Index / VIX'));
    const creditChart = globalCharts.find((chart) => chart.getAttribute('aria-label')?.includes('Credit Market'));
    const stockTable = element.querySelector<HTMLElement>('.stock-table');

    expect(piePanel).not.toBeNull();
    expect(globalCharts.length).toBe(2);
    expect(vixChart).not.toBeNull();
    expect(creditChart).not.toBeNull();
    expect(vixChart!.querySelector('.global-risk-chart-heading')).not.toBeNull();
    expect(textContent(vixChart!.querySelector('.global-risk-chart-heading'))).toContain('Fear Index / VIX');
    expect(stockTable).not.toBeNull();
    expect(Boolean(piePanel!.compareDocumentPosition(globalCharts[0]) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTrue();
    expect(Boolean(globalCharts[1].compareDocumentPosition(stockTable!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTrue();
    expect(vixChart!.getAttribute('aria-label')).toContain('15.32 index points');
    expect(creditChart!.getAttribute('aria-label')).toContain('0.74 spread %');
    expect(vixChart!.classList.contains('chart-flat')).toBeTrue();
    expect(vixChart!.classList.contains('chart-down')).toBeFalse();
    expect(creditChart!.classList.contains('chart-flat')).toBeTrue();
    expect(vixChart!.querySelector('.trend-threshold-line')).not.toBeNull();
    expect(creditChart!.querySelector('.trend-threshold-line')).not.toBeNull();
    expect(textContent(creditChart!.querySelector('.chart-range-options button.active'))).toBe('1m');
    expect(creditChart!.querySelector('.range-trend-svg .trend-line')?.getAttribute('d')).toContain('L');
    expect(state.ensureGlobalIndicatorChart).toHaveBeenCalledWith('vix');
    expect(state.ensureGlobalIndicatorChart).toHaveBeenCalledWith('credit');
    expect(state.globalIndicatorChartPoints).toHaveBeenCalledWith('vix');
    expect(state.globalIndicatorChartPoints).toHaveBeenCalledWith('credit');

    Array.from(creditChart!.querySelectorAll<HTMLButtonElement>('.chart-range-options button'))
      .find((button) => textContent(button) === '10y')
      ?.click();

    expect(state.setGlobalIndicatorChartRange).toHaveBeenCalledOnceWith('credit', '10y');
  });

  it('colors global risk charts as risk only when value or positive daily change crosses the threshold', async () => {
    const state = createState({
      stocks: [stock()],
      indicators: [
        indicator({ id: 'vix', name: 'Fear Index / VIX', category: 'Volatility', value: 18, unit: 'index points', change: 3 }),
        indicator({ value: 2.1, change: -0.15 }),
      ],
    });
    const { element } = await render(state);
    const globalCharts = Array.from(element.querySelectorAll<HTMLElement>('.global-risk-chart-panel'));
    const vixChart = globalCharts.find((chart) => chart.getAttribute('aria-label')?.includes('Fear Index / VIX'));
    const creditChart = globalCharts.find((chart) => chart.getAttribute('aria-label')?.includes('Credit Market'));

    expect(vixChart?.classList.contains('chart-down')).toBeTrue();
    expect(vixChart?.classList.contains('chart-flat')).toBeFalse();
    expect(creditChart?.classList.contains('chart-down')).toBeTrue();
    expect(creditChart?.classList.contains('chart-flat')).toBeFalse();
  });

  it('uses row clicks for columns and the graph button for chart rows', async () => {
    const state = createState({ stocks: [stock()] });
    const { fixture, element } = await render(state);
    const row = positionRow(element, 'AAPL');
    const fetchSpy = state.fetchStockHistory as jasmine.Spy;

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.querySelector('.ticker-metrics')).not.toBeNull();
    expect(row.querySelector('.position-chart-row')).toBeNull();

    row.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.classList.contains('collapsed-row')).toBeTrue();
    expect(fixture.componentInstance.isCollapsed(stock())).toBeTrue();
    expect(row.querySelector('.position-chart-row')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(textContent(row.querySelector('.row-actions .position-expand-hint'))).toBe('click to show indicators');
    expect(row.querySelector('.ticker-identity .position-expand-hint')).toBeNull();
    expect(textContent(row)).not.toContain('Avg');
    expect(textContent(row)).not.toContain('Qty');
    expect(textContent(row)).not.toContain('Price');

    row.querySelector<HTMLButtonElement>('.position-expand-hint')?.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.classList.contains('collapsed-row')).toBeFalse();
    expect(row.querySelector('.ticker-metrics')).not.toBeNull();
    expect(row.querySelector('.position-expand-hint')).toBeNull();

    row.querySelector<HTMLButtonElement>('.graph-action')?.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.querySelector('.ticker-metrics')).not.toBeNull();
    expect(row.querySelector('.position-chart-row')).not.toBeNull();
    const rangeButtons = Array.from(row.querySelectorAll('.chart-range-options button'));
    expect(rangeButtons.length).toBe(8);
    expect(textContent(rangeButtons[6])).toBe('10y');
    expect(textContent(row.querySelector('.chart-range-options button.active'))).toBe('1m');
    expect(row.querySelector('.range-trend-svg .trend-line')?.getAttribute('d')).toContain('L');
    expect(row.querySelectorAll('.trend-x-axis-label').length).toBeGreaterThan(1);
    expect(row.querySelectorAll('.trend-y-axis-label').length).toBeGreaterThan(1);
    expect(fetchSpy).toHaveBeenCalledWith('demo', 'password123', 'AAPL', '1m');

    row.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.classList.contains('collapsed-row')).toBeTrue();
    expect(row.querySelector('.position-chart-row')).not.toBeNull();
  });

  it('reuses cached position history when returning to an already loaded range', async () => {
    const state = createState({ stocks: [stock()] });
    const { fixture, element } = await render(state);
    const fetchSpy = state.fetchStockHistory as jasmine.Spy;
    const row = positionRow(element, 'AAPL');

    row.querySelector<HTMLButtonElement>('.graph-action')?.click();
    fixture.detectChanges();

    expect(fetchSpy.calls.count()).toBe(1);
    expect(fetchSpy.calls.mostRecent().args).toEqual(['demo', 'password123', 'AAPL', '1m']);

    Array.from(row.querySelectorAll<HTMLButtonElement>('.chart-range-options button'))
      .find((button) => textContent(button) === '1y')
      ?.click();
    fixture.detectChanges();

    expect(fetchSpy.calls.count()).toBe(2);
    expect(fetchSpy.calls.mostRecent().args).toEqual(['demo', 'password123', 'AAPL', '1y']);

    Array.from(row.querySelectorAll<HTMLButtonElement>('.chart-range-options button'))
      .find((button) => textContent(button) === '1m')
      ?.click();
    fixture.detectChanges();

    expect(fetchSpy.calls.count()).toBe(2);
  });

  it('keeps multiple position graphs open and reloads each open graph on range changes', async () => {
    const state = createState({
      stocks: [
        stock(),
        stock({ id: 2, symbol: 'MSFT', companyName: 'Microsoft Corp.' }),
      ],
    });
    const { fixture, element } = await render(state);
    const fetchSpy = state.fetchStockHistory as jasmine.Spy;
    const aaplRow = positionRow(element, 'AAPL');
    const msftRow = positionRow(element, 'MSFT');

    aaplRow.querySelector<HTMLButtonElement>('.graph-action')?.click();
    msftRow.querySelector<HTMLButtonElement>('.graph-action')?.click();
    fixture.detectChanges();

    expect(aaplRow.querySelector('.position-chart-row')).not.toBeNull();
    expect(msftRow.querySelector('.position-chart-row')).not.toBeNull();
    expect(fetchSpy.calls.count()).toBe(2);
    expect(fetchSpy.calls.allArgs()).toContain(['demo', 'password123', 'AAPL', '1m']);
    expect(fetchSpy.calls.allArgs()).toContain(['demo', 'password123', 'MSFT', '1m']);

    Array.from(aaplRow.querySelectorAll<HTMLButtonElement>('.chart-range-options button'))
      .find((button) => textContent(button) === '10y')
      ?.click();
    fixture.detectChanges();

    expect(aaplRow.querySelector('.position-chart-row')).not.toBeNull();
    expect(msftRow.querySelector('.position-chart-row')).not.toBeNull();
    expect(textContent(aaplRow.querySelector('.chart-range-options button.active'))).toBe('10y');
    expect(textContent(msftRow.querySelector('.chart-range-options button.active'))).toBe('10y');
    expect(fetchSpy.calls.count()).toBe(4);
    expect(fetchSpy.calls.allArgs()).toContain(['demo', 'password123', 'AAPL', '10y']);
    expect(fetchSpy.calls.allArgs()).toContain(['demo', 'password123', 'MSFT', '10y']);

    aaplRow.querySelector<HTMLButtonElement>('.graph-action')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(aaplRow.querySelector('.position-chart-row')).toBeNull();
    expect(msftRow.querySelector('.position-chart-row')).not.toBeNull();
  });

  it('does not cache an empty position history response', async () => {
    const fetchSpy = jasmine.createSpy('fetchStockHistory').and.returnValues(
      of({ id: 'AAPL', range: '1m', points: [] }),
      of({
        id: 'AAPL',
        range: '1m',
        points: [
          { timestamp: '2026-05-01T00:00:00Z', value: 22 },
          { timestamp: '2026-06-01T00:00:00Z', value: 25 },
        ],
      }),
    );
    const { fixture, element } = await render(createState({
      stocks: [stock()],
      fetchStockHistory: fetchSpy,
    }));
    const row = positionRow(element, 'AAPL');
    const graphButton = row.querySelector<HTMLButtonElement>('.graph-action');

    graphButton?.click();
    fixture.detectChanges();

    expect(fetchSpy.calls.count()).toBe(1);
    expect(textContent(row.querySelector('.trend-empty-label'))).toContain('No historical data');

    graphButton?.click();
    fixture.detectChanges();
    graphButton?.click();
    fixture.detectChanges();

    expect(fetchSpy.calls.count()).toBe(2);
    expect(row.querySelector('.range-trend-svg .trend-line')?.getAttribute('d')).toContain('L');
  });

  it('opens edit and delete actions in a dialog without collapsing the row', async () => {
    const position = stock();
    const { fixture, element } = await render(createState({ stocks: [position] }));
    const component = fixture.componentInstance;
    const editSpy = jasmine.createSpy('edit');
    const deleteSpy = jasmine.createSpy('delete');
    component.editPosition.subscribe(editSpy);
    component.deletePosition.subscribe(deleteSpy);

    const row = positionRow(element, 'AAPL');
    const menuButton = row.querySelector<HTMLButtonElement>('.menu-action');
    menuButton?.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.classList.contains('collapsed-row')).toBeFalse();
    expect(element.querySelector('.position-action-dialog')).not.toBeNull();

    element.querySelector<HTMLElement>('.position-action-backdrop')?.click();
    fixture.detectChanges();

    expect(element.querySelector('.position-action-dialog')).not.toBeNull();

    const actionButtons = Array.from(element.querySelectorAll<HTMLButtonElement>('.position-action-dialog button'));
    actionButtons.find((button) => textContent(button) === 'Edit')?.click();
    fixture.detectChanges();

    expect(editSpy).toHaveBeenCalledOnceWith(position);
    expect(element.querySelector('.position-action-dialog')).toBeNull();

    menuButton?.click();
    fixture.detectChanges();
    Array.from(element.querySelectorAll<HTMLButtonElement>('.position-action-dialog button'))
      .find((button) => textContent(button) === 'Delete')
      ?.click();
    fixture.detectChanges();

    expect(deleteSpy).toHaveBeenCalledOnceWith(position);
    expect(element.querySelector('.position-action-dialog')).toBeNull();
  });

  it('keeps the row expanded when tooltip targets are clicked', async () => {
    const { fixture, element } = await render(createState({ stocks: [stock()] }));
    const row = positionRow(element, 'AAPL');
    const tooltipTargets = [
      row.querySelector<HTMLElement>('.position-type-dot'),
      row.querySelector<HTMLElement>('.ticket-type-indicator'),
      row.querySelector<HTMLElement>('.position-title-inline-metric'),
      row.querySelector<HTMLElement>('.position-title-lines'),
      row.querySelector<HTMLElement>('.metric-30d'),
      row.querySelector<HTMLElement>('.risk-fear'),
    ];

    expect(tooltipTargets.every(Boolean)).toBeTrue();
    expect(row.getAttribute('aria-expanded')).toBe('true');

    for (const target of tooltipTargets) {
      target?.click();
      fixture.detectChanges();

      expect(row.getAttribute('aria-expanded')).toBe('true');
      expect(row.classList.contains('collapsed-row')).toBeFalse();
      expect(row.querySelector('.ticker-metrics')).not.toBeNull();
    }
  });

  it('hides default no-alert reason text while keeping real reasons visible', async () => {
    const { element } = await render(createState({
      stocks: [
        stock({ symbol: 'AAPL', reason: 'No watched stock alerts fired under current thresholds.' }),
        stock({ id: 2, symbol: 'MSFT', reason: 'P/E and fear thresholds are elevated.' }),
      ],
    }));

    expect(element.textContent).not.toContain('No watched stock alerts fired under current thresholds.');
    expect(element.textContent).toContain('P/E and fear thresholds are elevated.');
  });

  it('renders today change and position P&L details in the title area while expanded', async () => {
    const { element } = await render(createState({ stocks: [stock()] }));
    const row = positionRow(element, 'AAPL');
    const identity = row.querySelector('.ticker-identity');
    const todayMetric = row.querySelector('.position-title-inline-metric');
    const todayText = textContent(todayMetric);

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(identity).not.toBeNull();
    expect(identity?.contains(todayMetric)).toBeTrue();
    expect(todayText).toContain('2.5%');
    expect(todayText).toContain('$2.50');
    expect(todayText).toContain('4');
    expect(todayText).toContain('$10.00');
    expect(row.querySelector('.position-title-arrow')?.classList.contains('value-pos')).toBeTrue();
    expect(row.querySelector('.position-title-percent')?.classList.contains('value-pos')).toBeTrue();
    expect(row.querySelector('.position-title-value')?.classList.contains('value-pos')).toBeTrue();

    const positionLines = row.querySelector('.position-title-lines');
    const positionLineText = textContent(positionLines);
    expect(positionLines).not.toBeNull();
    expect(identity?.contains(positionLines)).toBeTrue();
    expect(positionLineText).toContain('Current');
    expect(positionLineText).toContain('4');
    expect(positionLineText).toContain('$25');
    expect(positionLineText).toContain('$100');
    expect(positionLineText).toContain('25%');
    expect(positionLineText).toContain('Original');
    expect(positionLineText).toContain('$20');
    expect(positionLineText).toContain('$80');
    expect(row.querySelector('.ticker-metrics')).not.toBeNull();

    const titleTooltip = row.querySelector<HTMLElement>('.ticket-type-indicator');
    expect(titleTooltip?.getAttribute('data-tooltip')).toBe('Apple Inc.');
    expect(titleTooltip?.getAttribute('data-tooltip')).not.toContain('TOTAL:');
    expect(titleTooltip?.getAttribute('data-tooltip')).not.toContain('Original:');
    expect(positionLines?.getAttribute('data-tooltip')).toContain('Current shows the current market value');
    expect(positionLines?.getAttribute('data-tooltip')).toContain('Original shows the invested cost');
    expect(positionLines?.getAttribute('data-tooltip')).not.toContain('$100');
    expect(positionLines?.getAttribute('data-tooltip')).not.toContain('25%');
  });

  it('shows today change and current price for watch-only rows without a position total', async () => {
    const watchOnly = stock({
      id: 2,
      symbol: 'MSFT',
      companyName: 'Microsoft',
      quantity: 0,
      averageCost: 0,
      dayGainLoss: -3.2,
      dayGainLossPercent: -1.25,
      unrealizedGainLoss: null,
      unrealizedGainLossPercent: null,
      watchOnly: true,
    });
    const { fixture, element } = await render(createState({ stocks: [watchOnly] }));
    const row = positionRow(element, 'MSFT');

    expect(row.getAttribute('aria-expanded')).toBeNull();
    expect(row.getAttribute('tabindex')).toBe('0');

    row.click();
    fixture.detectChanges();

    expect(row.classList.contains('collapsed-row')).toBeFalse();
    expect(row.querySelector('.position-chart-row')).toBeNull();

    row.querySelector<HTMLButtonElement>('.graph-action')?.click();
    fixture.detectChanges();

    expect(row.querySelector('.position-chart-row')).not.toBeNull();
    expect(textContent(row.querySelector('.watch-only-badge'))).toBe('Watch only');

    const todayMetric = row.querySelector('.position-title-inline-metric');
    const todayText = textContent(todayMetric);
    expect(todayText).toContain('1.25%');
    expect(todayText).toContain('-$3.20');
    expect(todayText).not.toContain('=');
    expect(row.querySelector('.position-title-arrow')?.classList.contains('value-neg')).toBeTrue();
    expect(row.querySelector('.position-title-percent')?.classList.contains('value-neg')).toBeTrue();
    expect(row.querySelector('.position-title-value')?.classList.contains('value-neg')).toBeTrue();

    const positionLines = row.querySelector('.position-title-lines');
    expect(textContent(positionLines)).toContain('Current');
    expect(textContent(positionLines)).toContain('$25');
    expect(textContent(positionLines)).not.toContain('Original');
    expect(textContent(positionLines)).not.toContain('=');
    expect(positionLines?.getAttribute('data-tooltip')).toContain('latest available price');
  });

  it('hides current total percent when unrealized percent is unavailable', async () => {
    const position = stock({
      unrealizedGainLoss: null,
      unrealizedGainLossPercent: null,
    });
    const { element } = await render(createState({ stocks: [position] }));
    const row = positionRow(element, 'AAPL');
    const positionLines = row.querySelector('.position-title-lines');

    expect(textContent(positionLines)).toContain('Current');
    expect(textContent(positionLines)).toContain('$100');
    expect(positionLines?.querySelector('.position-title-percent')).toBeNull();
    expect(positionLines?.querySelector('.position-title-line-primary .position-title-arrow')).toBeNull();
  });

  it('keeps 30D and Market Cap as the first expanded metric columns', async () => {
    const { element } = await render(createState({ stocks: [stock()] }));
    const row = positionRow(element, 'AAPL');
    const metricLabels = Array.from(row.querySelectorAll('.ticker-metrics small')).map(textContent);

    expect(metricLabels.slice(0, 2)).toEqual(['30D', 'Market Cap']);
    expect(row.querySelector<HTMLElement>('.metric-30d')?.getAttribute('data-tooltip')).toContain('percentage price change');
    expect(metricLabels).not.toContain('Price');
    expect(metricLabels).not.toContain('Avg');
    expect(metricLabels).not.toContain('Qty');
  });
});

