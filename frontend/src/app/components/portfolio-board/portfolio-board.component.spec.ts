import { TestBed } from '@angular/core/testing';
import { MarketDashboardService } from '../../market-dashboard.service';
import { PortfolioBoardComponent } from './portfolio-board.component';

describe('PortfolioBoardComponent', () => {
  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoading: false,
      stocks: [],
      ...overrides,
    } as MarketDashboardService;
  }

  async function render(state: MarketDashboardService) {
    await TestBed.configureTestingModule({
      imports: [PortfolioBoardComponent],
      providers: [{ provide: MarketDashboardService, useValue: state }],
    }).compileComponents();

    const fixture = TestBed.createComponent(PortfolioBoardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows loading indicator while loading portfolio data', async () => {
    const element = await render(createState({ isLoading: true, stocks: [] }));
    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading portfolio...');
  });

  it('renders empty portfolio description when loaded with no stocks', async () => {
    const element = await render(createState({ isLoading: false, stocks: [] }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.textContent).toContain('Add a portfolio position above, then configure Finnhub to enrich it with live market data.');
  });

  it('does not show empty-state description while loading even with no stocks', async () => {
    const element = await render(createState({ isLoading: true, stocks: [] }));
    expect(element.textContent).not.toContain('Add a portfolio position above');
  });
});

