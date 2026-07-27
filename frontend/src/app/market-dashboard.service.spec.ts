import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MarketDashboardService } from './market-dashboard.service';

describe('MarketDashboardService', () => {
  let service: MarketDashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        MarketDashboardService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(MarketDashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('uses same-origin API URLs for local and Tailscale hosts', () => {
    service.fetchPortfolio('user', 'password123').subscribe();

    const request = http.expectOne('/api/portfolio');
    expect(request.request.url.startsWith('http://localhost')).toBeFalse();
    expect(request.request.url.startsWith('http://127.0.0.1')).toBeFalse();
    request.flush([]);
  });

  it('fetches lightweight position prices from their own endpoint', () => {
    service.fetchStockPrices('user', 'password123').subscribe();

    const request = http.expectOne('/api/stocks/prices');
    expect(request.request.headers.get('Authorization')).toBe(`Basic ${btoa('user:password123')}`);
    request.flush([]);
  });

  it('omits includeIndicators from lightweight symbol searches', () => {
    service.searchSymbols('user', 'password123', 'app').subscribe((results) => {
      expect(results).toEqual([]);
    });

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/symbols/search'
      && candidate.params.get('keywords') === 'app'
    );
    expect(request.request.params.has('includeIndicators')).toBeFalse();
    expect(request.request.params.has('includePriceDetails')).toBeFalse();
    expect(request.request.headers.get('Authorization')).toBe(`Basic ${btoa('user:password123')}`);

    request.flush([]);
  });

  it('can request lightweight price details without full indicators', () => {
    service.searchSymbols('user', 'password123', 'app', false, true).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/symbols/search'
      && candidate.params.get('keywords') === 'app'
    );
    expect(request.request.params.has('includeIndicators')).toBeFalse();
    expect(request.request.params.get('includePriceDetails')).toBe('true');

    request.flush([]);
  });

  it('only sends includeIndicators when explicitly requested', () => {
    service.searchSymbols('user', 'password123', 'app', true).subscribe();

    const request = http.expectOne((candidate) =>
      candidate.url === '/api/symbols/search'
      && candidate.params.get('keywords') === 'app'
    );
    expect(request.request.params.get('includeIndicators')).toBe('true');

    request.flush([]);
  });

  it('sends browser-stored market API tokens only with market data requests', () => {
    localStorage.setItem('openfire_market_api_token_finnhub', 'user-finnhub-token');
    localStorage.setItem('openfire_market_api_token_twelvedata', 'user-twelve-token');

    service.searchSymbols('user', 'password123', 'app', false, true).subscribe();

    const searchRequest = http.expectOne((candidate) => candidate.url === '/api/symbols/search');
    expect(searchRequest.request.headers.get('X-OpenFire-Api-Token-Finnhub')).toBe('user-finnhub-token');
    expect(searchRequest.request.headers.get('X-OpenFire-Api-Token-TwelveData')).toBe('user-twelve-token');
    searchRequest.flush([]);
  });

  it('uses the existing server session when restoring a remembered login without a password', () => {
    service.fetchIndicators('demoUser', '').subscribe();

    const request = http.expectOne('/api/indicators');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush([]);
  });

  it('removes browser tokens for retired market API providers', () => {
    localStorage.setItem('openfire_market_api_token_fmp', 'fmp-token');
    localStorage.setItem('openfire_market_api_token_alphavantage', 'alpha-token');
    localStorage.setItem('openfire_market_api_token_eodhd', 'eodhd-token');

    service.loadMarketApiTokenDraftsFromBrowser();

    expect(localStorage.getItem('openfire_market_api_token_fmp')).toBeNull();
    expect(localStorage.getItem('openfire_market_api_token_alphavantage')).toBeNull();
    expect(localStorage.getItem('openfire_market_api_token_eodhd')).toBeNull();
  });

  it('loads and saves market API token drafts in local storage', () => {
    localStorage.setItem('openfire_market_api_token_twelvedata', 'twelve-token');

    service.loadMarketApiTokenDraftsFromBrowser();

    expect(service.draftMarketApiToken('twelvedata')).toBe('twelve-token');

    service.setDraftMarketApiToken('finnhub', 'finnhub-token');
    service.setDraftMarketApiToken('twelvedata', '');
    service.saveMarketApiTokenDraftsToBrowser();

    expect(localStorage.getItem('openfire_market_api_token_finnhub')).toBe('finnhub-token');
    expect(localStorage.getItem('openfire_market_api_token_twelvedata')).toBeNull();
  });

  it('tests the draft market API token without saving it to browser storage', () => {
    service.setDraftMarketApiToken('finnhub', 'draft-token');

    service.testMarketApiToken('user', 'password123', 'finnhub').subscribe((result) => {
      expect(result).toEqual({
        provider: 'finnhub',
        success: true,
        message: 'Finnhub token works.',
      });
    });

    const request = http.expectOne('/api/users/me/market-apis/finnhub/test');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe(`Basic ${btoa('user:password123')}`);
    expect(request.request.headers.get('X-OpenFire-Api-Token-Finnhub')).toBe('draft-token');
    expect(localStorage.getItem('openfire_market_api_token_finnhub')).toBeNull();
    request.flush({
      provider: 'finnhub',
      success: true,
      message: 'Finnhub token works.',
    });
  });

  it('detects whether a draft market API token can be tested', () => {
    service.setDraftMarketApiToken('finnhub', '   ');
    service.setDraftMarketApiToken('twelvedata', 'twelve-token');

    expect(service.hasDraftMarketApiToken('finnhub')).toBeFalse();
    expect(service.hasDraftMarketApiToken('twelvedata')).toBeTrue();
    expect(service.hasAnyDraftMarketApiToken()).toBeTrue();

    service.setDraftMarketApiToken('twelvedata', '');

    expect(service.hasAnyDraftMarketApiToken()).toBeFalse();
  });

  it('clears a token test result when the draft token changes', () => {
    service.setMarketApiTokenTestState('finnhub', 'success', 'Finnhub token works.');

    service.setDraftMarketApiToken('finnhub', 'new-token');

    expect(service.marketApiTokenTestMessage('finnhub')).toBe('');
    expect(service.marketApiTokenTestSucceeded('finnhub')).toBeFalse();
  });

  it('toggles API token visibility per provider', () => {
    expect(service.isMarketApiTokenVisible('finnhub')).toBeFalse();

    service.toggleMarketApiTokenVisibility('finnhub');

    expect(service.isMarketApiTokenVisible('finnhub')).toBeTrue();
    expect(service.isMarketApiTokenVisible('twelvedata')).toBeFalse();

    service.clearMarketApiTokenVisibility();

    expect(service.isMarketApiTokenVisible('finnhub')).toBeFalse();
  });

  it('retries global risk chart history after an empty response', fakeAsync(() => {
    service.username = 'user';
    service.password = 'password123';
    const expectVixHistoryRequest = () => http.expectOne((candidate) =>
      candidate.url === '/api/indicators/vix/history'
      && candidate.params.get('range') === '1y'
    );

    service.ensureGlobalIndicatorChart('vix');
    const firstRequest = expectVixHistoryRequest();
    expect(firstRequest.request.headers.get('Authorization')).toBe(`Basic ${btoa('user:password123')}`);
    firstRequest.flush({ id: 'vix', range: '1y', points: [] });

    expect(service.globalIndicatorChartPoints('vix')).toEqual([]);
    service.ensureGlobalIndicatorChart('vix');
    http.expectNone((candidate) => candidate.url === '/api/indicators/vix/history');

    tick(10_000);
    service.ensureGlobalIndicatorChart('vix');
    const secondRequest = expectVixHistoryRequest();
    secondRequest.flush({
      id: 'vix',
      range: '1y',
      points: [{ timestamp: '2026-06-08T12:00:00Z', value: 18.5 }],
    });

    expect(service.globalIndicatorChartPoints('vix')).toEqual([
      { timestamp: '2026-06-08T12:00:00Z', value: 18.5 },
    ]);
    service.ensureGlobalIndicatorChart('vix');
    http.expectNone((candidate) => candidate.url === '/api/indicators/vix/history');
  }));
});
