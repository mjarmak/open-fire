import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { AnalyticsService } from '../../analytics.service';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.scss']
})
export class CookieConsentComponent {
  constructor(public readonly analytics: AnalyticsService) {}
}
