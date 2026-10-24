import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, PLATFORM_ID } from '@angular/core';
import { mountConsentDialog } from '@jeniusapps/consent';
import { AnalyticsService } from '../../analytics.service';

@Component({ selector: 'app-cookie-consent', standalone: true, template: '' })
export class CookieConsentComponent implements AfterViewInit, OnDestroy {
  private unmount?: () => void;
  constructor(
    private readonly host: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) private readonly platform: object,
    private readonly analytics: AnalyticsService
  ) {}

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platform)) this.unmount = mountConsentDialog(this.host.nativeElement, this.analytics.manager, { analyticsProvider: 'jenius' });
  }

  ngOnDestroy(): void { this.unmount?.(); }
}
