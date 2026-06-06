import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { StockAlert } from '../../market-dashboard.models';
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

  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoading: false,
      isLoadingStocks: false,
      isImportingPortfolio: false,
      stocks: [],
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

  it('collapses and expands a position when its row is clicked', async () => {
    const { fixture, element } = await render(createState({ stocks: [stock()] }));
    const row = positionRow(element, 'AAPL');

    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(row.querySelector('.ticker-metrics')).not.toBeNull();

    row.click();
    fixture.detectChanges();

    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(row.classList.contains('collapsed-row')).toBeTrue();
    expect(row.querySelector('.ticker-metrics')).toBeNull();
    expect(textContent(row.querySelector('.row-actions .position-expand-hint'))).toBe('click to expand');
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

  it('shows today change for watch-only rows without a position total', async () => {
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
    expect(row.getAttribute('tabindex')).toBeNull();

    row.click();
    fixture.detectChanges();

    expect(row.classList.contains('collapsed-row')).toBeFalse();
    expect(textContent(row.querySelector('.watch-only-badge'))).toBe('Watch only');

    const todayMetric = row.querySelector('.position-title-inline-metric');
    const todayText = textContent(todayMetric);
    expect(todayText).toContain('1.25%');
    expect(todayText).toContain('-$3.20');
    expect(todayText).not.toContain('=');
    expect(row.querySelector('.position-title-arrow')?.classList.contains('value-neg')).toBeTrue();
    expect(row.querySelector('.position-title-percent')?.classList.contains('value-neg')).toBeTrue();
    expect(row.querySelector('.position-title-value')?.classList.contains('value-neg')).toBeTrue();
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

