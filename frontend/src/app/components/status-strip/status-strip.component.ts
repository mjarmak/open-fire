import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';

@Component({
  selector: 'app-status-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-strip.component.html',
})
export class StatusStripComponent {
  protected readonly state = inject(MarketDashboardService);
}
