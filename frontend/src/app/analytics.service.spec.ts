import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AnalyticsService } from './analytics.service';

const CONSENT_KEY = 'jenius-consent-v2-open-fire';
describe('AnalyticsService shared consent adapter', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
    document.cookie = 'jeniusapps-analytics-consent=; Max-Age=0; Path=/';
    document.getElementById('jeniusapps-google-analytics')?.remove();
    delete window.gtag;
    window.dataLayer = [];
    TestBed.configureTestingModule({ imports: [RouterTestingModule] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
    document.cookie = 'jeniusapps-analytics-consent=; Max-Age=0; Path=/';
    document.getElementById('jeniusapps-google-analytics')?.remove();
    window.localStorage.clear();
    delete window.gtag;
    window.dataLayer = [];
  });
  it('starts without analytics', () => {
    const service = TestBed.inject(AnalyticsService);
    expect(service.showPrompt).toBeTrue();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  });
  it('remembers cookies-only permission without loading analytics', () => {
    const service = TestBed.inject(AnalyticsService);
    service.allowCookies();
    expect(service.consent).toBe('cookies');
    expect(JSON.parse(window.localStorage.getItem(CONSENT_KEY)!).choice).toBe('cookies');
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  });
  it('saves analytics consent without loading Google and respects withdrawal', fakeAsync(() => {
    const service = TestBed.inject(AnalyticsService);
    service.accept();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
    expect(service.consent).toBe('granted');
    service.decline();
    flushMicrotasks();
    expect(service.consent).toBe('denied');
    expect(window.dataLayer).toEqual([]);
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  }));
  it('does not reuse legacy shared acceptance', () => {
    document.cookie = 'jeniusapps-analytics-consent=granted; Path=/';
    const service = TestBed.inject(AnalyticsService);
    expect(service.showPrompt).toBeTrue();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  });
});
