import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Output, ViewChild } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class HeaderComponent {
  private static readonly MENU_DIALOG_WIDTH = 256;
  private static readonly MENU_DIALOG_GAP = 6;
  private static readonly VIEWPORT_MARGIN = 8;

  protected readonly state = inject(MarketDashboardService);
  protected menuOpen = false;
  protected menuDialogLeft = HeaderComponent.VIEWPORT_MARGIN;
  protected menuDialogTop = 48;

  @ViewChild('menuButton', { read: ElementRef })
  private menuButton?: ElementRef<HTMLButtonElement>;

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() openAlerts = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() searchStock = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() openLogin = new EventEmitter<void>();
  @Output() openCreateUser = new EventEmitter<void>();
  @Output() openFeedback = new EventEmitter<void>();
  @Output() openApiTokens = new EventEmitter<void>();

  @HostListener('window:resize')
  protected repositionOpenMenu(): void {
    if (this.menuOpen) {
      this.positionMenuDialog();
    }
  }

  protected openMenu(): void {
    this.positionMenuDialog();
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

  protected selectFeedback(): void {
    this.openFeedback.emit();
    this.closeMenu();
  }

  protected selectApiTokens(): void {
    this.openApiTokens.emit();
    this.closeMenu();
  }

  protected selectLogout(): void {
    this.logout.emit();
    this.closeMenu();
  }

  private positionMenuDialog(): void {
    const buttonBounds = this.menuButton?.nativeElement.getBoundingClientRect();
    if (!buttonBounds) {
      return;
    }

    const maximumLeft = Math.max(
      HeaderComponent.VIEWPORT_MARGIN,
      window.innerWidth - HeaderComponent.MENU_DIALOG_WIDTH - HeaderComponent.VIEWPORT_MARGIN,
    );

    this.menuDialogLeft = Math.min(
      Math.max(buttonBounds.left, HeaderComponent.VIEWPORT_MARGIN),
      maximumLeft,
    );
    this.menuDialogTop = buttonBounds.bottom + HeaderComponent.MENU_DIALOG_GAP;
  }
}
