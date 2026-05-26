import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() openAlerts = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() openLogin = new EventEmitter<void>();
  @Output() openCreateUser = new EventEmitter<void>();
}
