import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { AnalyticsService } from './analytics.service';

const CONSENT_KEY = 'jeniusapps-analytics-consent';

describe('AnalyticsService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
    document.getElementById('jeniusapps-google-analytics')?.remove();
    delete window.gtag;
    window.dataLayer = [];

    TestBed.configureTestingModule({
      imports: [RouterTestingModule]
    });
  });

  afterEach(() => {
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/`;
    document.getElementById('jeniusapps-google-analytics')?.remove();
    window.localStorage.clear();
    delete window.gtag;
    window.dataLayer = [];
    TestBed.resetTestingModule();
  });

  it('does not load Google Analytics before a visitor accepts', () => {
    const service = TestBed.inject(AnalyticsService);

    expect(service.showPrompt).toBeTrue();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  });

  it('loads the shared Jenius Tech measurement tag after consent', () => {
    const service = TestBed.inject(AnalyticsService);
    service.accept();

    const script = document.getElementById('jeniusapps-google-analytics') as HTMLScriptElement | null;
    expect(service.consent).toBe('granted');
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('granted');
    expect(document.cookie).toContain(`${CONSENT_KEY}=granted`);
    expect(script?.src).toContain('G-WKKVN7YL28');
  });

  it('uses the shared consent cookie on a later visit', () => {
    document.cookie = `${CONSENT_KEY}=denied; Path=/; SameSite=Lax`;

    const service = TestBed.inject(AnalyticsService);

    expect(service.consent).toBe('denied');
    expect(service.showPrompt).toBeFalse();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
  });
});
