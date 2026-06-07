import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { IndicatorSnapshot } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { IndicatorGridComponent } from './indicator-grid.component';

describe('IndicatorGridComponent', () => {
  function indicator(overrides: Partial<IndicatorSnapshot> = {}): IndicatorSnapshot {
    return {
      id: 'vix',
      name: 'Fear Index / VIX',
      category: 'Volatility',
      value: 15.32,
      unit: 'index points',
      change: -0.4,
      status: 'fear',
      source: 'Mock',
      lastUpdated: new Date().toISOString(),
      description: 'Volatility benchmark for broad market stress.',
      ...overrides,
    };
  }

  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoading: false,
      isLoadingIndicators: false,
      isLoggedIn: true,
      username: 'demo',
      password: 'password123',
      safeWithdrawalRate: 4,
      desiredMonthlyIncome: 3000,
      yearlyInflationRate: 3,
      stocks: [],
      indicators: [],
      ...overrides,
    } as MarketDashboardService;
  }

  async function render(state: MarketDashboardService) {
    await TestBed.configureTestingModule({
      imports: [IndicatorGridComponent],
      providers: [
        { provide: MarketDashboardService, useValue: state },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IndicatorGridComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a loading indicator when loading indicators', async () => {
    const element = await render(createState({ isLoadingIndicators: true }));

    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading market indicators and retirement progress...');
    expect(element.querySelector('.retirement-progress-indicator')).toBeNull();
  });

  it('does not mask indicators for unrelated dashboard loading', async () => {
    const element = await render(createState({ isLoading: true, isLoadingIndicators: false }));

    expect(element.querySelector('.section-loading .loading-spinner')).toBeNull();
    expect(element.querySelector('.retirement-progress-indicator')).not.toBeNull();
  });

  it('renders retirement progress indicator when loaded with no indicators', async () => {
    const element = await render(createState({ indicators: [] }));

    expect(element.querySelector('.section-loading .loading-spinner')).toBeNull();
    expect(element.querySelector('.retirement-progress-indicator')).not.toBeNull();
    expect(element.textContent).toContain('Progress');
    expect(element.textContent).toContain('of target');
  });

  it('renders compact credit and volatility indicators without inline chart controls', async () => {
    const state = createState({ indicators: [indicator()] });
    const element = await render(state);
    const card = element.querySelector<HTMLElement>('.compact-indicator');

    expect(card).not.toBeNull();
    expect(card?.querySelector('.indicator-chart-panel')).toBeNull();
  });

  it('puts compact indicator tooltips on the gauge cards without info buttons', async () => {
    const state = createState({ indicators: [indicator()] });
    const element = await render(state);
    const card = element.querySelector<HTMLElement>('.compact-indicator');
    const retirementCard = element.querySelector<HTMLElement>('.retirement-progress-indicator');

    expect(card?.querySelector('.indicator-help')).toBeNull();
    expect(card?.classList.contains('app-tooltip')).toBeTrue();
    expect(card?.getAttribute('data-tooltip')).toBe('Volatility benchmark for broad market stress.');
    expect(card?.getAttribute('tabindex')).toBe('0');
    expect(retirementCard?.querySelector('.indicator-help')).toBeNull();
    expect(retirementCard?.getAttribute('data-tooltip')).toContain('Current non-watch-only portfolio value');
  });
});
