import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { IndicatorSnapshot } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';

@Component({
  selector: 'app-indicator-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './indicator-grid.component.html',
})
export class IndicatorGridComponent {
  protected readonly state = inject(MarketDashboardService);

  statusClass(status: string): string {
    return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  isCompactIndicator(indicator: IndicatorSnapshot): boolean {
    return indicator.id === 'vix' || indicator.id === 'credit';
  }
}
