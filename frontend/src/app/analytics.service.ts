import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

const MEASUREMENT_ID = 'G-WKKVN7YL28';
const CONSENT_KEY = 'jeniusapps-analytics-consent';
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type AnalyticsConsent = 'granted' | 'denied' | null;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService implements OnDestroy {
  private readonly browser: boolean;
  private readonly routerSubscription?: Subscription;
  private initialized = false;
  private lastPagePath = '';
  private currentConsent: AnalyticsConsent = null;

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) platformId: object,
    private readonly router: Router,
    private readonly title: Title
  ) {
    this.browser = isPlatformBrowser(platformId);
    if (!this.browser) {
      return;
    }

    this.currentConsent = this.readStoredConsent();
    if (this.currentConsent === 'granted') {
      this.initialize();
    }

    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.schedulePageView());
  }

  get consent(): AnalyticsConsent {
    return this.currentConsent;
  }

  get showPrompt(): boolean {
    return this.currentConsent === null;
  }

  accept(): void {
    this.storeConsent('granted');
    this.currentConsent = 'granted';
    this.initialize();
  }

  decline(): void {
    this.storeConsent('denied');
    this.currentConsent = 'denied';
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  private initialize(): void {
    if (!this.browser || this.initialized) {
      return;
    }

    this.initialized = true;
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = (...args: unknown[]) => window.dataLayer.push(args);
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    window.gtag('js', new Date());
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false });

    if (!this.document.getElementById('jeniusapps-google-analytics')) {
      const script = this.document.createElement('script');
      script.id = 'jeniusapps-google-analytics';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      this.document.head.appendChild(script);
    }

    this.schedulePageView();
  }

  private schedulePageView(): void {
    if (!this.initialized || !this.browser) {
      return;
    }

    queueMicrotask(() => this.trackPageView());
  }

  private trackPageView(): void {
    const pagePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (!window.gtag || pagePath === this.lastPagePath) {
      return;
    }

    this.lastPagePath = pagePath;
    window.gtag('event', 'page_view', {
      page_title: this.title.getTitle(),
      page_location: window.location.href,
      page_path: pagePath
    });
  }

  private readStoredConsent(): AnalyticsConsent {
    const cookieConsent = this.readConsentCookie();
    if (cookieConsent) {
      return cookieConsent;
    }

    try {
      const value = window.localStorage.getItem(CONSENT_KEY);
      return value === 'granted' || value === 'denied' ? value : null;
    } catch {
      return null;
    }
  }

  private readConsentCookie(): AnalyticsConsent {
    const value = this.document.cookie
      .split(';')
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith(`${CONSENT_KEY}=`))
      ?.slice(CONSENT_KEY.length + 1);

    return value === 'granted' || value === 'denied' ? value : null;
  }

  private storeConsent(value: Exclude<AnalyticsConsent, null>): void {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // The shared cookie still preserves the choice when local storage is unavailable.
    }

    const hostname = window.location.hostname.toLowerCase();
    const sharedDomain = hostname === 'jeniusapps.com' || hostname.endsWith('.jeniusapps.com');
    const domain = sharedDomain ? '; Domain=.jeniusapps.com' : '';
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    this.document.cookie = `${CONSENT_KEY}=${value}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${domain}${secure}`;
  }
}
