import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ConsentManager, createConsentManager, createGoogleAnalytics, GoogleAnalyticsAdapter } from '@jeniusapps/consent';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AnalyticsService implements OnDestroy {
  readonly manager: ConsentManager;
  private readonly adapter: GoogleAnalyticsAdapter;
  private readonly unsubscribe: () => void;
  private readonly routerSubscription: Subscription;

  constructor(@Inject(DOCUMENT) document: Document, @Inject(PLATFORM_ID) platform: object, router: Router) {
    const enabled = isPlatformBrowser(platform);
    this.manager = createConsentManager({ document, appId: 'open-fire', appName: 'Open Fire', enabled });
    this.adapter = createGoogleAnalytics({ document, manager: this.manager, measurementId: 'G-WKKVN7YL28', enabled });
    this.unsubscribe = this.manager.subscribe(state => {
      if (state.analytics) queueMicrotask(() => this.adapter.trackPageView());
    });
    this.routerSubscription = router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => queueMicrotask(() => this.adapter.trackPageView()));
  }

  get consent() { return this.manager.getState().choice; }
  get showPrompt(): boolean { return this.manager.getState().showPrompt; }
  accept(): void { this.manager.choose('granted'); }
  allowCookies(): void { this.manager.choose('cookies'); }
  decline(): void { this.manager.choose('denied'); }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    this.unsubscribe();
    this.adapter.destroy();
    this.manager.destroy();
  }
}
