import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { StockAlert } from '../../market-dashboard.models';

@Component({
  selector: 'app-stock-risk-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-risk-panel.component.html',
})
export class StockRiskPanelComponent {
  @Input({ required: true }) stock!: StockAlert;

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
}
