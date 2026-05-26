import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-alerts-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alerts-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class AlertsDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() configureTelegram = new EventEmitter<void>();

  get alertingStocks(): StockAlert[] {
    return this.state.stocks
      .filter((stock) => stock.alert)
      .sort((left, right) => left.symbol.localeCompare(right.symbol));
  }
}
