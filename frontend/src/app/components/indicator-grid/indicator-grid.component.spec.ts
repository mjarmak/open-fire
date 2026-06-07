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
    const retirementCard = element.querySelector<HTMLElement>('.retirement-progress-indicator');
    const speedometer = retirementCard?.querySelector<HTMLElement>('.mini-speedometer');

    expect(element.querySelector('.section-loading .loading-spinner')).toBeNull();
    expect(retirementCard).not.toBeNull();
    expect(element.textContent).toContain('Progress');
    expect(element.textContent).toContain('of $900K');
    expect(speedometer?.style.getPropertyValue('--gauge-sweep')).toBe('');
  });

  it('maps retirement progress from zero to target across the left-to-right gauge arc', async () => {
    const element = await render(createState({
      indicators: [],
      stocks: [
        { watchOnly: false, marketValue: 90_000 } as any,
      ],
    }));
    const speedometer = element.querySelector<HTMLElement>('.retirement-speedometer');

    expect(element.textContent).toContain('10%');
    expect(speedometer?.style.getPropertyValue('--gauge-needle')).toBe('-162deg');
  });

  it('keeps compact macro gauges primary unless the risk threshold is crossed', async () => {
    const element = await render(createState({
      indicators: [
        indicator({
          value: 12.5,
          change: -0.4,
          status: 'calm',
        }),
      ],
    }));
    const card = element.querySelector<HTMLElement>('.compact-indicator');
    const speedometer = card?.querySelector<HTMLElement>('.mini-speedometer');

    expect(card?.classList.contains('status-primary')).toBeTrue();
    expect(card?.classList.contains('status-risk')).toBeFalse();
    expect(speedometer?.style.getPropertyValue('--gauge-threshold')).toBe('60deg');
    expect(speedometer?.style.getPropertyValue('--gauge-risk-start')).toBe('60deg');
    expect(speedometer?.style.getPropertyValue('--gauge-risk-end')).toBe('180deg');
    expect(speedometer?.style.getPropertyValue('--gauge-needle')).toBe('-150deg');
  });

  it('colors compact macro gauge containers as risk when value or positive daily change crosses the threshold', async () => {
    const element = await render(createState({
      indicators: [
        indicator({
          id: 'credit',
          name: 'Credit Market',
          category: 'Credit',
          value: 0.74,
          unit: 'spread %',
          change: 0.15,
          status: 'watch',
        }),
      ],
    }));
    const card = element.querySelector<HTMLElement>('.compact-indicator');

    expect(card?.classList.contains('status-risk')).toBeTrue();
    expect(card?.classList.contains('status-primary')).toBeFalse();
  });

  it('renders compact credit and volatility indicators without inline chart controls', async () => {
    const state = createState({ indicators: [indicator()] });
    const element = await render(state);
    const card = element.querySelector<HTMLElement>('.compact-indicator');

    expect(card).not.toBeNull();
    expect(card?.querySelector('.indicator-chart-panel')).toBeNull();
  });

  it('puts compact indicator tooltips on the gauge cards without info buttons', async () => {
    const state = createState({
      indicators: [
        indicator(),
        indicator({
          id: 'credit',
          name: 'Credit Market',
          category: 'Credit',
          value: 0.74,
          unit: 'spread %',
          description: 'Credit stress proxy.',
        }),
      ],
    });
    const element = await render(state);
    const card = element.querySelector<HTMLElement>('.compact-indicator');
    const creditCard = Array.from(element.querySelectorAll<HTMLElement>('.compact-indicator'))
      .find((indicatorCard) => indicatorCard.textContent?.includes('Credit Market'));
    const retirementCard = element.querySelector<HTMLElement>('.retirement-progress-indicator');

    expect(card?.querySelector('.indicator-help')).toBeNull();
    expect(card?.classList.contains('app-tooltip')).toBeTrue();
    expect(card?.getAttribute('data-tooltip')).toBe('Volatility benchmark for broad market stress. Risk threshold: 25 index points or +3 daily change.');
    expect(card?.getAttribute('tabindex')).toBe('0');
    expect(creditCard?.getAttribute('data-tooltip')).toBe('Credit stress proxy. Risk threshold: 2.0 spread % or +0.15 daily change.');
    expect(retirementCard?.querySelector('.indicator-help')).toBeNull();
    expect(retirementCard?.getAttribute('data-tooltip')).toContain('Current non-watch-only portfolio value');
    expect(retirementCard?.getAttribute('data-tooltip')).toContain('Target Retirement Fund');
    expect(retirementCard?.getAttribute('data-tooltip')).toContain('no risk thresholds');
    expect(retirementCard?.getAttribute('data-tooltip')).toContain('$900K');
  });
});
