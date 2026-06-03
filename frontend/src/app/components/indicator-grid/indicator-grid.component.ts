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
  protected readonly retirementProgressTooltip = 'Current non-watch-only portfolio value divided by today\'s required retirement fund from your retirement settings.';

  statusClass(status: string): string {
    return `status-${status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  isCompactIndicator(indicator: IndicatorSnapshot): boolean {
    return indicator.id === 'vix' || indicator.id === 'credit';
  }

  gaugePercent(indicator: IndicatorSnapshot): number {
    const value = Number(indicator.value) || 0;
    const range = indicator.id === 'credit'
      ? { min: 0, max: 5 }
      : { min: 10, max: 40 };
    const percent = ((value - range.min) / (range.max - range.min)) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  gaugeNeedleRotation(indicator: IndicatorSnapshot): number {
    return -90 + (this.gaugePercent(indicator) / 100) * 180;
  }

  gaugeSweep(indicator: IndicatorSnapshot): number {
    return (this.gaugePercent(indicator) / 100) * 180;
  }

  get currentRetirementValue(): number {
    return this.state.stocks
      .filter((stock) => !stock.watchOnly)
      .reduce((sum, stock) => sum + (stock.marketValue || 0), 0);
  }

  get retirementTargetFund(): number {
    const safeWithdrawalRatio = Math.max(0.001, this.state.safeWithdrawalRate / 100);
    return (this.state.desiredMonthlyIncome * 12) / safeWithdrawalRatio;
  }

  get retirementProgressPercent(): number {
    if (this.retirementTargetFund <= 0) return 0;
    return Math.max(0, Math.min(100, (this.currentRetirementValue / this.retirementTargetFund) * 100));
  }

  get retirementProgressNeedleRotation(): number {
    return -90 + (this.retirementProgressPercent / 100) * 180;
  }

  get retirementProgressSweep(): number {
    return (this.retirementProgressPercent / 100) * 180;
  }

  get retirementProgressStatusClass(): string {
    if (this.retirementProgressPercent >= 75) return 'status-calm';
    if (this.retirementProgressPercent >= 35) return 'status-watch';
    return 'status-risk';
  }
}
