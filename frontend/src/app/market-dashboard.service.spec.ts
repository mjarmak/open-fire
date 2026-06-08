import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
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
});
