import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { AlertsDialogComponent } from './alerts-dialog.component';

describe('AlertsDialogComponent', () => {
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
      marketValue: 100,
      costBasis: 80,
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

  async function render(overrides: Partial<MarketDashboardService> = {}): Promise<{
    fixture: ComponentFixture<AlertsDialogComponent>;
    element: HTMLElement;
  }> {
    const state = {
      alertsDialogOpen: true,
      isLoadingStocks: false,
      isLoadingIndicators: false,
      isLoadingStockDetails: false,
      stocks: [],
      ...overrides,
    } as MarketDashboardService;

    await TestBed.configureTestingModule({
      imports: [AlertsDialogComponent],
      providers: [
        { provide: MarketDashboardService, useValue: state },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AlertsDialogComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a loading skeleton instead of the empty message while positions are loading', async () => {
    const { element } = await render({ isLoadingStocks: true });

    expect(element.querySelector('.alerts-loading-skeleton[role="status"]')).not.toBeNull();
    expect(element.querySelectorAll('.alert-item-skeleton')).toHaveSize(4);
    expect(element.textContent).not.toContain('No active alerts right now.');
  });

  it('shows a loading skeleton instead of the empty message while macro risk indicators are loading', async () => {
    const { element } = await render({ isLoadingIndicators: true });

    expect(element.querySelector('.alerts-loading-skeleton[role="status"]')).not.toBeNull();
    expect(element.querySelectorAll('.alert-item-skeleton')).toHaveSize(4);
    expect(element.textContent).not.toContain('No active alerts right now.');
  });

  it('shows a loading skeleton instead of the empty message while position risk details are loading', async () => {
    const { element } = await render({ isLoadingStockDetails: true });

    expect(element.querySelector('.alerts-loading-skeleton[role="status"]')).not.toBeNull();
    expect(element.querySelectorAll('.alert-item-skeleton')).toHaveSize(4);
    expect(element.textContent).not.toContain('No active alerts right now.');
  });

  it('shows the empty message only after positions and risk indicators finish loading', async () => {
    const { element } = await render();

    expect(element.querySelector('.alerts-loading-skeleton')).toBeNull();
    expect(element.textContent).toContain('No active alerts right now.');
  });

  it('shows active alert rows when loaded alerts exist', async () => {
    const { element } = await render({
      stocks: [
        stock({ symbol: 'MSFT', companyName: 'Microsoft', alert: false }),
        stock({ symbol: 'AAPL', companyName: 'Apple Inc.', alert: true, reason: 'High volatility.' }),
      ],
    });

    expect(element.querySelector('.alerts-loading-skeleton')).toBeNull();
    expect(element.querySelector('.empty-state')).toBeNull();
    expect(element.querySelectorAll('.alert-item')).toHaveSize(1);
    expect(element.textContent).toContain('AAPL');
    expect(element.textContent).toContain('High volatility.');
    expect(element.textContent).not.toContain('MSFT');
  });
});
