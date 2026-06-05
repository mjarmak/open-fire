import { TestBed } from '@angular/core/testing';
import { MarketDashboardService } from '../../market-dashboard.service';
import { IndicatorGridComponent } from './indicator-grid.component';

describe('IndicatorGridComponent', () => {
  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoading: false,
      isLoggedIn: true,
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
      providers: [{ provide: MarketDashboardService, useValue: state }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IndicatorGridComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a loading indicator when loading indicators', async () => {
    const element = await render(createState({ isLoading: true }));

    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading market indicators and retirement progress...');
    expect(element.querySelector('.retirement-progress-indicator')).toBeNull();
  });

  it('renders retirement progress indicator when loaded with no indicators', async () => {
    const element = await render(createState({ indicators: [] }));

    expect(element.querySelector('.section-loading .loading-spinner')).toBeNull();
    expect(element.querySelector('.retirement-progress-indicator')).not.toBeNull();
    expect(element.textContent).toContain('Progress');
    expect(element.textContent).toContain('of target');
  });
});
