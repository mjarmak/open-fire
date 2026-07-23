import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockAlert, SymbolSearchResult } from '../../market-dashboard.models';
import { StockLookupResultRowComponent } from './stock-lookup-result-row.component';

describe('StockLookupResultRowComponent', () => {
  function stock(overrides: Partial<StockAlert> = {}): StockAlert {
    return {
      id: null,
      symbol: 'AAPL',
      companyName: 'Apple Inc.',
      positionType: 'Technology',
      quantity: 0,
      averageCost: 0,
      latestPrice: 198.2,
      marketCap: 2_900_000_000_000,
      peRatio: null,
      beta: null,
      realizedVolatilityPercent: null,
      drawdownPercent: null,
      fearScore: null,
      marketValue: null,
      costBasis: null,
      dayGainLoss: 18.2,
      dayGainLossPercent: 0.77,
      unrealizedGainLoss: null,
      unrealizedGainLossPercent: null,
      thirtyDayChangePercent: null,
      watchOnly: true,
      alert: false,
      reason: 'Price details loaded.',
      ...overrides,
    };
  }

  async function render(result: SymbolSearchResult): Promise<{
    fixture: ComponentFixture<StockLookupResultRowComponent>;
    element: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [StockLookupResultRowComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(StockLookupResultRowComponent);
    fixture.componentRef.setInput('result', result);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders lightweight price details without daily or history-backed indicators', async () => {
    const { element } = await render({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
      indicators: stock(),
    });

    expect(element.classList.contains('stock-row')).toBeTrue();
    expect(element.classList.contains('stock-lookup-result-row')).toBeTrue();
    expect(element.textContent).toContain('AAPL');
    expect(element.textContent).toContain('Apple Inc.');
    expect(element.textContent).toContain('Price');
    expect(element.textContent).toContain('$198.20');
    expect(element.textContent).toContain('Market Cap');
    expect(element.textContent).toContain('$2.9T');
    expect(element.textContent).not.toContain('Today');
    expect(element.textContent).not.toContain('0.77%');
    expect(element.textContent).not.toContain('$18.20');
    expect(element.textContent).not.toContain('Fear');
    expect(element.textContent).not.toContain('30D');
    expect(element.textContent).not.toContain('P/E');
  });

  it('emits the selected result when add is clicked', async () => {
    const result: SymbolSearchResult = {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      region: 'US',
      currency: 'USD',
      indicators: stock(),
    };
    const { fixture, element } = await render(result);
    const emitted: SymbolSearchResult[] = [];
    fixture.componentInstance.add.subscribe((value) => emitted.push(value));

    element.querySelector<HTMLButtonElement>('.stock-lookup-add-button')?.click();

    expect(emitted).toEqual([result]);
  });

  it('hides market cap for crypto search results', async () => {
    const { element } = await render({
      symbol: 'BINANCE:BTCUSDT',
      name: 'Bitcoin / USDT',
      region: 'Crypto',
      currency: 'USDT',
      indicators: stock({
        symbol: 'BINANCE:BTCUSDT',
        companyName: 'Bitcoin / USDT',
        positionType: 'Crypto',
        marketCap: 1_000_000_000,
      }),
    });

    expect(element.textContent).toContain('Price');
    expect(element.textContent).toContain('$198.20');
    expect(element.textContent).not.toContain('Market Cap');
    expect(element.textContent).not.toContain('$1B');
  });
});
