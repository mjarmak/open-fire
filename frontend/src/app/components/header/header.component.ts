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
  protected menuOpen = false;

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() openAlerts = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() searchStock = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() openLogin = new EventEmitter<void>();
  @Output() openCreateUser = new EventEmitter<void>();

  protected openMenu(): void {
    this.menuOpen = true;
  }

  protected closeMenu(): void {
    this.menuOpen = false;
  }

  protected selectTheme(): void {
    this.toggleTheme.emit();
    this.closeMenu();
  }

  protected selectRefresh(): void {
    this.refresh.emit();
    this.closeMenu();
  }

  protected selectLogout(): void {
    this.logout.emit();
    this.closeMenu();
  }
}
