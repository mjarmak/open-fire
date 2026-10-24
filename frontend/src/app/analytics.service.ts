import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, OnDestroy, PLATFORM_ID } from '@angular/core';
import { ConsentManager, createConsentManager, retireGoogleAnalytics } from '@jeniusapps/consent';
import { createOptionalLogger, OptionalLogger } from '@jeniusapps/analytics-client';

@Injectable({ providedIn: 'root' })
export class AnalyticsService implements OnDestroy {
  readonly manager: ConsentManager;
  private readonly logger: OptionalLogger;

  constructor(@Inject(DOCUMENT) document: Document, @Inject(PLATFORM_ID) platform: object) {
    const enabled = isPlatformBrowser(platform);
    this.manager = createConsentManager({ document, appId: 'open-fire', appName: 'Open Fire', enabled, noticeVersion: 2 });
    retireGoogleAnalytics({ document, appId: 'open-fire', measurementId: 'G-WKKVN7YL28', enabled });
    this.logger = createOptionalLogger({ document, manager: this.manager, slug: 'open-fire' });
  }

  get consent() { return this.manager.getState().choice; }
  get showPrompt(): boolean { return this.manager.getState().showPrompt; }
  accept(): void { this.manager.choose('granted'); }
  allowCookies(): void { this.manager.choose('cookies'); }
  decline(): void { this.manager.choose('denied'); }
  recordHttpError(error: {url: string; method: string; status: number}): void { this.logger.recordHttpError(error); }
  ngOnDestroy(): void { this.logger.destroy(); this.manager.destroy(); }
}
