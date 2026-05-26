import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';

type ProjectionLine = 'ideal' | 'actual' | 'custom';
type ExtendedProjectionLine = ProjectionLine | 'idealNoWithdraw' | 'actualNoWithdraw' | 'customNoWithdraw';

type RetirementProjection = {
  year: number;
  ideal: number;
  actual: number;
  custom: number;
  idealNoWithdraw: number;
  actualNoWithdraw: number;
  customNoWithdraw: number;
  target: number;
  idealRetired: boolean;
  actualRetired: boolean;
  customRetired: boolean;
};

type RetirementSnapshot = {
  currentPortfolioValue: number;
  currentPortfolioCost: number;
  totalProfitLoss: number;
  actualCagr: number;
  safeWithdrawalRatio: number;
  targetRetirementFund: number;
  projections: RetirementProjection[];
  minChartValue: number;
  maxChartValue: number;
};

@Component({
  selector: 'app-retirement-planner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './retirement-planner.component.html',
})
export class RetirementPlannerComponent {
  protected readonly state = inject(MarketDashboardService);
  private snapshotCacheKey = '';
  private snapshotCache: RetirementSnapshot | null = null;

  @Output() configure = new EventEmitter<void>();

  hoveredYear: number | null = null;
  hoverX = 0;
  hoverY = 0;

  get currentPortfolioValue(): number {
    return this.snapshot.currentPortfolioValue;
  }

  get currentPortfolioCost(): number {
    return this.snapshot.currentPortfolioCost;
  }

  get totalProfitLoss(): number {
    return this.snapshot.totalProfitLoss;
  }

  get totalProfitLossPercent(): number {
    const cost = this.currentPortfolioCost;
    if (cost <= 0) return 0;
    return (this.totalProfitLoss / cost) * 100;
  }

  get actualCAGR(): number {
    return this.snapshot.actualCagr;
  }

  get targetRetirementFund(): number {
    return this.snapshot.targetRetirementFund;
  }

  get projections(): RetirementProjection[] {
    return this.snapshot.projections;
  }

  get safeWithdrawalRatio(): number {
    return this.snapshot.safeWithdrawalRatio;
  }

  get maxChartValue(): number {
    return this.snapshot.maxChartValue;
  }

  get minChartValue(): number {
    return this.snapshot.minChartValue;
  }

  get targetYCoordinate(): number {
    return this.chartYForValue(this.targetRetirementFund);
  }

  get chartYTicks(): { value: number; y: number; label: string }[] {
    const minLog = Math.log10(this.minChartValue);
    const maxLog = Math.log10(this.maxChartValue);
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
      const value = Math.pow(10, minLog + (maxLog - minLog) * ratio);
      return {
        value,
        y: this.chartYForValue(value),
        label: this.formatMoney(value),
      };
    });
  }

  get hoveredProjection(): RetirementProjection | null {
    if (this.hoveredYear === null) return null;
    return this.projections.find((p) => p.year === this.hoveredYear) || null;
  }

  getYearsToRetire(line: ProjectionLine): string {
    const proj = this.projections;
    for (let i = 0; i < proj.length; i++) {
      const retired = line === 'ideal' ? proj[i].idealRetired : line === 'actual' ? proj[i].actualRetired : proj[i].customRetired;
      const val = line === 'ideal' ? proj[i].ideal : line === 'actual' ? proj[i].actual : proj[i].custom;
      if (retired || val >= proj[i].target) {
        return `${proj[i].year} ${proj[i].year === 1 ? 'year' : 'years'}`;
      }
    }
    return '> 30 years';
  }

  getSvgPath(line: ExtendedProjectionLine): string {
    const proj = this.projections;
    if (proj.length === 0) return '';

    return proj.map((p, index) => {
      const x = 60 + (p.year / 30) * 680;
      const val = line === 'ideal'
        ? p.ideal
        : line === 'actual'
        ? p.actual
        : line === 'custom'
        ? p.custom
        : line === 'idealNoWithdraw'
        ? p.idealNoWithdraw
        : line === 'actualNoWithdraw'
        ? p.actualNoWithdraw
        : p.customNoWithdraw;
      const y = this.chartYForValue(val);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  getSvgAreaPath(line: ProjectionLine): string {
    const linePath = this.getSvgPath(line);
    if (!linePath) return '';
    const x0 = 60;
    const xEnd = 60 + 680;
    const yBaseline = 260;
    return `${linePath} L ${xEnd.toFixed(1)} ${yBaseline} L ${x0.toFixed(1)} ${yBaseline} Z`;
  }

  getTargetSvgPath(): string {
    const proj = this.projections;
    if (proj.length === 0) return '';
    return proj.map((p, index) => {
      const x = 60 + (p.year / 30) * 680;
      const y = this.chartYForValue(p.target);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }

  onChartMouseMove(event: MouseEvent): void {
    const svgElement = event.currentTarget as SVGGraphicsElement;
    const rect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const graphWidth = 680;
    const startX = 60;

    let relativeX = mouseX - startX;
    if (relativeX < 0) relativeX = 0;
    if (relativeX > graphWidth) relativeX = graphWidth;

    const year = Math.round((relativeX / graphWidth) * 30);
    this.hoveredYear = year;
    this.hoverX = startX + (year / 30) * graphWidth;
    this.hoverY = event.clientY - rect.top - 10;
  }

  onChartMouseLeave(): void {
    this.hoveredYear = null;
  }

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

  private projectNoWithdrawalBalance(initial: number, monthly: number, annualRate: number, years: number): number {
    const months = Math.max(0, Math.round(years * 12));
    const monthlyRate = annualRate / 12;
    let balance = initial;

    for (let month = 1; month <= months; month++) {
      balance *= 1 + monthlyRate;
      balance += monthly;
      balance = Math.max(0, balance);
    }

    return balance;
  }

  private get snapshot(): RetirementSnapshot {
    const stocksKey = this.state.stocks
      .map((stock) => `${stock.symbol}:${stock.watchOnly ? 1 : 0}:${stock.marketValue ?? 0}:${stock.costBasis ?? 0}:${stock.unrealizedGainLoss ?? 0}`)
      .join('|');
    const key = [
      stocksKey,
      this.state.investingStartDate,
      this.state.desiredMonthlyIncome,
      this.state.customReturnRate,
      this.state.monthlySavings,
      this.state.otherSavings,
      this.state.yearlyInflationRate,
      this.state.safeWithdrawalRate,
    ].join('::');

    if (this.snapshotCache && this.snapshotCacheKey === key) {
      return this.snapshotCache;
    }

    const currentPortfolioValue = this.state.stocks
      .filter((stock) => !stock.watchOnly)
      .reduce((sum, stock) => sum + (stock.marketValue || 0), 0);
    const currentPortfolioCost = this.state.stocks
      .filter((stock) => !stock.watchOnly)
      .reduce((sum, stock) => sum + (stock.costBasis || 0), 0);
    const totalProfitLoss = this.state.stocks
      .filter((stock) => !stock.watchOnly)
      .reduce((sum, stock) => sum + (stock.unrealizedGainLoss || 0), 0);
    const safeWithdrawalRatio = Math.max(0.001, this.state.safeWithdrawalRate / 100);
    const actualCagr = this.computeActualCagr(currentPortfolioValue, currentPortfolioCost);
    const targetRetirementFund = this.retirementTargetAtYear(
      0,
      this.state.desiredMonthlyIncome,
      this.state.yearlyInflationRate,
      safeWithdrawalRatio,
    );

    const projections: RetirementProjection[] = [];
    const startVal = currentPortfolioValue || this.state.otherSavings;
    const monthly = this.state.monthlySavings;
    const idealRate = 0.10;
    const customRate = this.state.customReturnRate / 100;

    for (let y = 0; y <= 30; y++) {
      const ideal = this.projectRetirementBalanceWithInputs(startVal, monthly, idealRate, y, safeWithdrawalRatio);
      const actual = this.projectRetirementBalanceWithInputs(startVal, monthly, actualCagr, y, safeWithdrawalRatio);
      const custom = this.projectRetirementBalanceWithInputs(startVal, monthly, customRate, y, safeWithdrawalRatio);
      const idealNoWithdraw = this.projectNoWithdrawalBalance(startVal, monthly, idealRate, y);
      const actualNoWithdraw = this.projectNoWithdrawalBalance(startVal, monthly, actualCagr, y);
      const customNoWithdraw = this.projectNoWithdrawalBalance(startVal, monthly, customRate, y);
      projections.push({
        year: y,
        ideal: ideal.balance,
        actual: actual.balance,
        custom: custom.balance,
        idealNoWithdraw,
        actualNoWithdraw,
        customNoWithdraw,
        target: this.retirementTargetAtYear(y, this.state.desiredMonthlyIncome, this.state.yearlyInflationRate, safeWithdrawalRatio),
        idealRetired: ideal.retired,
        actualRetired: actual.retired,
        customRetired: custom.retired,
      });
    }

    const maxProjectionValue = Math.max(
      ...projections.map((projection) => Math.max(
        projection.ideal,
        projection.actual,
        projection.custom,
        projection.idealNoWithdraw,
        projection.actualNoWithdraw,
        projection.customNoWithdraw,
        projection.target,
      )),
    );
    const maxChartValue = Math.max(1, maxProjectionValue * 1.12);
    const positiveValues = projections
      .flatMap((projection) => [
        projection.ideal,
        projection.actual,
        projection.custom,
        projection.idealNoWithdraw,
        projection.actualNoWithdraw,
        projection.customNoWithdraw,
        projection.target,
      ])
      .filter((value) => value > 0);
    const minPositive = positiveValues.length ? Math.min(...positiveValues) : 1;
    const minChartValue = Math.max(1, Math.min(minPositive, currentPortfolioValue || this.state.otherSavings || 1));

    this.snapshotCacheKey = key;
    this.snapshotCache = {
      currentPortfolioValue,
      currentPortfolioCost,
      totalProfitLoss,
      actualCagr,
      safeWithdrawalRatio,
      targetRetirementFund,
      projections,
      minChartValue,
      maxChartValue,
    };
    return this.snapshotCache;
  }

  private computeActualCagr(currentPortfolioValue: number, currentPortfolioCost: number): number {
    if (!this.state.investingStartDate || currentPortfolioValue <= 0 || currentPortfolioCost <= 0) {
      return 0;
    }
    const startDate = new Date(this.state.investingStartDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timeDiff = today.getTime() - startDate.getTime();
    const years = timeDiff / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) {
      return 0.08;
    }
    return Math.pow(currentPortfolioValue / currentPortfolioCost, 1 / years) - 1;
  }

  private projectRetirementBalanceWithInputs(
    initial: number,
    monthly: number,
    annualRate: number,
    years: number,
    safeWithdrawalRatio: number,
  ): { balance: number; retired: boolean } {
    const months = Math.max(0, Math.round(years * 12));
    const monthlyRate = annualRate / 12;
    let balance = initial;
    let retired = false;

    for (let month = 1; month <= months; month++) {
      const elapsedYears = month / 12;
      balance *= 1 + monthlyRate;
      if (retired) {
        balance -= this.inflatedMonthlyIncome(elapsedYears, this.state.desiredMonthlyIncome, this.state.yearlyInflationRate);
      } else {
        balance += monthly;
        if (balance >= this.retirementTargetAtYear(
          elapsedYears,
          this.state.desiredMonthlyIncome,
          this.state.yearlyInflationRate,
          safeWithdrawalRatio,
        )) {
          retired = true;
        }
      }
      balance = Math.max(0, balance);
    }

    return { balance, retired };
  }

  private inflatedMonthlyIncome(years: number, desiredMonthlyIncome: number, yearlyInflationRate: number): number {
    return desiredMonthlyIncome * this.inflationFactor(years, yearlyInflationRate);
  }

  private retirementTargetAtYear(
    years: number,
    desiredMonthlyIncome: number,
    yearlyInflationRate: number,
    safeWithdrawalRatio: number,
  ): number {
    return (this.inflatedMonthlyIncome(years, desiredMonthlyIncome, yearlyInflationRate) * 12) / safeWithdrawalRatio;
  }

  private inflationFactor(years: number, yearlyInflationRate: number): number {
    const annualInflation = yearlyInflationRate / 100;
    return Math.pow(Math.max(0.01, 1 + annualInflation), Math.max(0, years));
  }

  private chartYForValue(value: number): number {
    const minValue = this.minChartValue;
    const maxValue = this.maxChartValue;
    if (maxValue <= minValue) {
      return 260;
    }

    const safeValue = Math.max(minValue, value);
    const minLog = Math.log10(minValue);
    const maxLog = Math.log10(maxValue);
    const ratio = (Math.log10(safeValue) - minLog) / (maxLog - minLog);
    return 260 - ratio * 210;
  }
}
