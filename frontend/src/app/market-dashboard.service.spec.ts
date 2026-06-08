import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MarketDashboardService } from './market-dashboard.service';

describe('MarketDashboardService', () => {
  let service: MarketDashboardService;
  let http: HttpTestingController;

  beforeEach(() => {
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
