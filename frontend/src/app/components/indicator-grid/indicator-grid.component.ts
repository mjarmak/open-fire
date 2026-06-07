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

  protected get retirementProgressTooltip(): string {
    return `Current non-watch-only portfolio value (${this.formatCompactCurrency(this.currentRetirementValue)}) on a neutral scale from $0 to the Target Retirement Fund (${this.formatCompactCurrency(this.retirementTargetFund)}). There are no risk thresholds on this gauge.`;
  }

  statusClass(indicator: IndicatorSnapshot): string {
    if (this.isCompactIndicator(indicator)) {
      return this.isCompactIndicatorOverThreshold(indicator) ? 'status-risk' : 'status-primary';
    }

    return `status-${indicator.status.toLowerCase().replace(/\s+/g, '-')}`;
  }

  isCompactIndicator(indicator: IndicatorSnapshot): boolean {
    return indicator.id === 'vix' || indicator.id === 'credit';
  }

  protected compactIndicatorTooltip(indicator: IndicatorSnapshot): string {
    const threshold = this.compactIndicatorThreshold(indicator);
    return threshold ? `${indicator.description} ${threshold}` : indicator.description;
  }

  gaugePercent(indicator: IndicatorSnapshot): number {
    const value = Number(indicator.value) || 0;
    const max = this.gaugeThreshold(indicator) * 3;
    const percent = (value / max) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  gaugeNeedleRotation(indicator: IndicatorSnapshot): number {
    return this.roundGaugeAngle(-180 + (this.gaugePercent(indicator) / 100) * 180);
  }

  gaugeSweep(indicator: IndicatorSnapshot): number {
    return this.roundGaugeAngle((this.gaugePercent(indicator) / 100) * 180);
  }

  gaugeThresholdSweep(indicator: IndicatorSnapshot): number {
    return 60;
  }

  gaugeRiskStart(indicator: IndicatorSnapshot): number {
    return this.gaugeThresholdSweep(indicator);
  }

  gaugeRiskEnd(indicator: IndicatorSnapshot): number {
    return 180;
  }

  protected isCompactIndicatorOverThreshold(indicator: IndicatorSnapshot): boolean {
    if (!this.isCompactIndicator(indicator)) {
      return false;
    }

    const value = Number(indicator.value) || 0;
    const change = Number(indicator.change) || 0;
    return value >= this.gaugeThreshold(indicator) || change >= this.gaugeChangeThreshold(indicator);
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
    return this.roundGaugeAngle(-180 + (this.retirementProgressPercent / 100) * 180);
  }

  protected formatCompactCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  private compactIndicatorThreshold(indicator: IndicatorSnapshot): string {
    if (indicator.id === 'vix') {
      return 'Risk threshold: 25 index points or +3 daily change.';
    }
    if (indicator.id === 'credit') {
      return 'Risk threshold: 2.0 spread % or +0.15 daily change.';
    }
    return '';
  }

  private gaugeThreshold(indicator: IndicatorSnapshot): number {
    return indicator.id === 'credit' ? 2 : 25;
  }

  private gaugeChangeThreshold(indicator: IndicatorSnapshot): number {
    return indicator.id === 'credit' ? 0.15 : 3;
  }

  private roundGaugeAngle(value: number): number {
    return Number(value.toFixed(4));
  }

}
