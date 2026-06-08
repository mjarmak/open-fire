import { CommonModule } from '@angular/common';
import { animate, style, transition, trigger } from '@angular/animations';
import { Component, DestroyRef, EventEmitter, OnInit, inject, Output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ChartPoint, IndicatorSnapshot, StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';
import { RangeTrendChartComponent, TrendChartPoint, TrendChartRange } from '../range-trend-chart/range-trend-chart.component';

type PositionTypeSlice = {
  label: string;
  value: number;
  percent: number;
  color: string;
  count: number;
};

type PositionFilter = 'all' | 'positions' | 'watchlist';

@Component({
  selector: 'app-portfolio-board',
  standalone: true,
  imports: [CommonModule, RangeTrendChartComponent],
  templateUrl: './portfolio-board.component.html',
  animations: [
    trigger('positionColumns', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('160ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        style({ display: 'none' }),
      ]),
    ]),
    trigger('positionChartExpansion', [
      transition(':enter', [
        style({
          height: 0,
          minHeight: 0,
          opacity: 0,
          paddingTop: 0,
          borderTopColor: 'transparent',
          overflow: 'hidden',
        }),
        animate('190ms ease-out', style({
          height: '*',
          opacity: 1,
          paddingTop: '*',
          borderTopColor: '*',
        })),
      ]),
      transition(':leave', [
        style({
          height: '*',
          opacity: 1,
          paddingTop: '*',
          borderTopColor: '*',
          overflow: 'hidden',
        }),
        animate('150ms ease-in', style({
          height: 0,
          minHeight: 0,
          opacity: 0,
          paddingTop: 0,
          borderTopColor: 'transparent',
        })),
      ]),
    ]),
  ],
})
export class PortfolioBoardComponent implements OnInit {
  protected readonly state = inject(MarketDashboardService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly positionFilters: { value: PositionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'positions', label: 'Positions' },
    { value: 'watchlist', label: 'Watchlist' },
  ];
  private readonly collapsedStateStorageKey = 'sma_collapsed_positions';
  private readonly typeColors = [
    '#2680eb',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
    '#ec4899',
    '#94a3b8',
  ];

  @Output() addPosition = new EventEmitter<void>();
  @Output() exportPositions = new EventEmitter<void>();
  @Output() importPositions = new EventEmitter<Event>();
  @Output() editPosition = new EventEmitter<StockAlert>();
  @Output() deletePosition = new EventEmitter<StockAlert>();
  collapsedSymbols = new Set<string>();
  protected positionFilter: PositionFilter = 'all';
  protected actionDialogRowKey: string | null = null;
  protected chartRowKeys = new Set<string>();
  protected readonly chartRanges: TrendChartRange[] = ['5d', '1m', '1y', '10y', 'all'];
  private readonly chartCache = new Map<string, TrendChartPoint[]>();
  private readonly loadingChartKeys = new Set<string>();
  private readonly positionChartRanges = new Map<string, TrendChartRange>();

  ngOnInit(): void {
    this.loadCollapsedState();
  }

  get displayedStocks(): StockAlert[] {
    return this.state.stocks.filter((stock) => this.matchesPositionFilter(stock)).sort((left, right) => {
      if (left.watchOnly !== right.watchOnly) {
        return left.watchOnly ? 1 : -1;
      }
      return left.symbol.localeCompare(right.symbol);
    });
  }

  protected setPositionFilter(filter: PositionFilter): void {
    this.positionFilter = filter;
  }

  protected positionFilterCount(filter: PositionFilter): number {
    if (filter === 'positions') {
      return this.state.stocks.filter((stock) => !stock.watchOnly).length;
    }

    if (filter === 'watchlist') {
      return this.state.stocks.filter((stock) => stock.watchOnly).length;
    }

    return this.state.stocks.length;
  }

  get positionTypeSlices(): PositionTypeSlice[] {
    const buckets = new Map<string, { value: number; count: number }>();
    const stocks = this.state.stocks.filter((stock) => !stock.watchOnly);
    const hasPortfolioValue = stocks.some((stock) => (stock.marketValue || 0) > 0);

    for (const stock of stocks) {
      const label = this.resolvePositionType(stock);
      const current = buckets.get(label) || { value: 0, count: 0 };
      current.count++;
      current.value += hasPortfolioValue ? stock.marketValue || 0 : 1;
      buckets.set(label, current);
    }

    const total = Array.from(buckets.values()).reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
      return [];
    }

    return Array.from(buckets.entries())
      .sort((left, right) => right[1].value - left[1].value)
      .map(([label, item], index) => ({
        label,
        value: item.value,
        percent: (item.value / total) * 100,
        color: this.typeColors[index % this.typeColors.length],
        count: item.count,
      }));
  }

  get positionTypePieGradient(): string {
    const slices = this.positionTypeSlices;
    if (!slices.length) {
      return 'conic-gradient(var(--border) 0 100%)';
    }

    let cursor = 0;
    const segments = slices.map((slice) => {
      const start = cursor;
      cursor += slice.percent;
      return `${slice.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  }

  get positionTypeBasisLabel(): string {
    return this.state.stocks.some((stock) => !stock.watchOnly && (stock.marketValue || 0) > 0)
      ? 'By current market value'
      : 'By number of positions';
  }

  getStockTypeLabel(stock: StockAlert): string {
    return this.resolvePositionType(stock);
  }

  getStockTypeColor(stock: StockAlert): string {
    const label = this.getStockTypeLabel(stock);
    const slice = this.positionTypeSlices.find((item) => item.label === label);
    if (slice) {
      return slice.color;
    }
    return this.typeColors[this.hashString(label) % this.typeColors.length];
  }

  getPieCategoryTooltip(category: string): string {
    const stocks = this.state.stocks
      .filter((stock) => !stock.watchOnly && this.resolvePositionType(stock) === category)
      .sort((left, right) => left.symbol.localeCompare(right.symbol));

    if (!stocks.length) {
      return category;
    }

    const lines = stocks.map((stock) => {
      const companyName = stock.companyName?.trim() || 'Unknown company';
      const position = this.formatQuantity(stock.quantity);
      const totalValue = this.formatTooltipMoney(this.resolveTotalValue(stock));
      const metrics = [`x${position}`, `Current: ${totalValue}`];
      const peRatio = this.formatTooltipRatio(stock.peRatio);
      if (peRatio) {
        metrics.push(`P/E: ${peRatio}`);
      }
      return `${stock.symbol} - ${companyName}\n${metrics.join(' | ')}`;
    });

    return lines.join('\n\n');
  }

  isCollapsed(stock: StockAlert): boolean {
    if (stock.watchOnly) {
      return false;
    }
    return this.collapsedSymbols.has(this.positionRowKey(stock));
  }

  toggleCollapsed(stock: StockAlert): void {
    if (stock.watchOnly) {
      this.collapsedSymbols.delete(this.positionRowKey(stock));
      this.persistCollapsedState();
      return;
    }

    const rowKey = this.positionRowKey(stock);
    if (this.collapsedSymbols.has(rowKey)) {
      this.collapsedSymbols.delete(rowKey);
    } else {
      this.collapsedSymbols.add(rowKey);
    }
    this.persistCollapsedState();
  }

  protected toggleCollapsedFromRow(stock: StockAlert, event?: Event): void {
    if (event && this.isTooltipInteraction(event)) {
      return;
    }

    this.actionDialogRowKey = null;
    if (!stock.watchOnly) {
      this.toggleCollapsed(stock);
    }
  }

  protected handleRowKeydown(stock: StockAlert, event: KeyboardEvent): void {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.toggleCollapsedFromRow(stock);
  }

  protected get actionDialogStock(): StockAlert | null {
    if (!this.actionDialogRowKey) {
      return null;
    }

    return this.displayedStocks.find((stock) => this.positionRowKey(stock) === this.actionDialogRowKey) ?? null;
  }

  protected isActionDialogOpen(stock: StockAlert): boolean {
    return this.actionDialogRowKey === this.positionRowKey(stock);
  }

  protected openActionDialog(stock: StockAlert, event: Event): void {
    event.stopPropagation();
    this.actionDialogRowKey = this.positionRowKey(stock);
  }

  protected closeActionDialog(): void {
    this.actionDialogRowKey = null;
  }

  protected stopRowClick(event: Event): void {
    event.stopPropagation();
  }

  protected isPositionChartOpen(stock: StockAlert): boolean {
    return this.chartRowKeys.has(this.positionRowKey(stock));
  }

  protected togglePositionChart(stock: StockAlert, event: Event): void {
    event.stopPropagation();
    this.actionDialogRowKey = null;
    const rowKey = this.positionRowKey(stock);
    if (this.chartRowKeys.has(rowKey)) {
      this.chartRowKeys.delete(rowKey);
    } else {
      this.chartRowKeys.add(rowKey);
      this.loadPositionChart(stock);
    }
  }

  protected selectedChartRange(stock: StockAlert): TrendChartRange {
    return this.positionChartRanges.get(this.positionRowKey(stock)) ?? '1m';
  }

  protected setChartRange(rowKey: string, range: TrendChartRange): void {
    if (this.positionChartRanges.get(rowKey) === range) {
      return;
    }

    this.positionChartRanges.set(rowKey, range);
    if (!this.chartRowKeys.has(rowKey)) {
      return;
    }

    const stock = this.displayedStocks.find((item) => this.positionRowKey(item) === rowKey);
    if (stock) {
      this.loadPositionChart(stock);
    }
  }

  protected get globalRiskIndicators(): IndicatorSnapshot[] {
    const indicators = this.state.indicators
      .filter((indicator) => this.isGlobalRiskIndicator(indicator))
      .sort((left, right) => this.globalRiskSortOrder(left.id) - this.globalRiskSortOrder(right.id));
    for (const indicator of indicators) {
      this.state.ensureGlobalIndicatorChart(indicator.id);
    }
    return indicators;
  }

  protected selectedGlobalRiskChartRange(indicator: IndicatorSnapshot): TrendChartRange {
    return this.asTrendChartRange(this.state.getGlobalIndicatorChartRange(indicator.id));
  }

  protected setGlobalRiskChartRange(indicator: IndicatorSnapshot, range: TrendChartRange): void {
    this.state.setGlobalIndicatorChartRange(indicator.id, range);
  }

  protected globalRiskChartData(indicator: IndicatorSnapshot): TrendChartPoint[] {
    return this.toTrendChartPoints(this.state.globalIndicatorChartPoints(indicator.id));
  }

  protected isGlobalRiskChartLoading(indicator: IndicatorSnapshot): boolean {
    return this.state.isGlobalIndicatorChartLoading(indicator.id);
  }

  protected globalRiskChartTone(indicator: IndicatorSnapshot): 'up' | 'down' | 'flat' {
    return this.isGlobalRiskIndicatorOverThreshold(indicator) ? 'down' : 'flat';
  }

  protected globalRiskChartThreshold(indicator: IndicatorSnapshot): number | null {
    if (indicator.id === 'vix') {
      return 25;
    }
    if (indicator.id === 'credit') {
      return 2;
    }
    if (indicator.id === 'breadth') {
      return 45;
    }
    if (indicator.id === 'correlation') {
      return 0.7;
    }
    if (indicator.id === 'fear-greed') {
      return 35;
    }
    return null;
  }

  protected globalRiskChartSummary(indicator: IndicatorSnapshot): string {
    const change = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(Number(indicator.change) || 0);
    return `${indicator.name} ${this.selectedGlobalRiskChartRange(indicator)} ${indicator.value} ${indicator.unit} ${change}`;
  }

  protected positionChartData(stock: StockAlert): TrendChartPoint[] {
    return this.chartCache.get(this.positionChartCacheKey(stock)) ?? [];
  }

  protected isPositionChartLoading(stock: StockAlert): boolean {
    return this.loadingChartKeys.has(this.positionChartCacheKey(stock));
  }

  protected positionChartTone(stock: StockAlert): 'up' | 'down' | 'flat' {
    const change = stock.dayGainLossPercent ?? stock.thirtyDayChangePercent ?? stock.unrealizedGainLossPercent ?? 0;
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'flat';
  }

  protected positionChartSummary(stock: StockAlert): string {
    const latest = stock.latestPrice ?? this.calculatePositionMarketValue(stock) ?? 0;
    const change = stock.dayGainLossPercent ?? stock.thirtyDayChangePercent ?? 0;
    const range = this.selectedChartRange(stock);
    const formattedChange = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
      signDisplay: 'exceptZero',
    }).format(change);
    return `${stock.symbol} ${range} ${this.formatMoney(latest)} ${formattedChange}%`;
  }

  protected positionAveragePriceLine(stock: StockAlert): number | null {
    if (stock.watchOnly || stock.averageCost === null || stock.averageCost === undefined) {
      return null;
    }

    return Number.isFinite(stock.averageCost) && stock.averageCost > 0 ? stock.averageCost : null;
  }

  private isTooltipInteraction(event: Event): boolean {
    const target = event.target instanceof Element ? event.target : null;
    const currentTarget = event.currentTarget instanceof Element ? event.currentTarget : null;
    const tooltipTarget = target?.closest('.app-tooltip, .metric-tooltip, [data-tooltip]');
    return Boolean(tooltipTarget && currentTarget?.contains(tooltipTarget));
  }

  protected selectEditPosition(stock: StockAlert, event: Event): void {
    event.stopPropagation();
    this.actionDialogRowKey = null;
    this.editPosition.emit(stock);
  }

  protected selectDeletePosition(stock: StockAlert, event: Event): void {
    event.stopPropagation();
    this.actionDialogRowKey = null;
    this.deletePosition.emit(stock);
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

  calculatePositionMarketValue(stock: StockAlert): number | null {
    if (stock.marketValue !== null && stock.marketValue !== undefined) {
      return stock.marketValue;
    }

    if (stock.latestPrice === null || stock.latestPrice === undefined) {
      return null;
    }

    return stock.quantity * stock.latestPrice;
  }

  calculatePositionInvested(stock: StockAlert): number | null {
    if (stock.averageCost === null || stock.averageCost === undefined || stock.watchOnly) {
      return null;
    }

    return stock.quantity * stock.averageCost;
  }

  protected getCompanyTitleTooltip(stock: StockAlert): string {
    return stock.companyName?.trim() || stock.symbol;
  }

  protected getPositionLinesTooltip(stock?: StockAlert): string {
    if (stock?.watchOnly) {
      return 'Current shows the latest available price and market cap.';
    }

    return 'Current shows the current market value and unrealized return.\nOriginal shows the invested cost based on the average price.';
  }

  formatStockDayChange(stock: StockAlert): string {
    const value = this.calculateStockDayChange(stock);
    if (value === null) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected visibleStockReason(stock: StockAlert): string {
    const reason = stock.reason?.trim() || '';
    return this.isNoAlertReason(reason) ? '' : reason;
  }

  formatPositionDayChange(stock: StockAlert): string {
    if (stock.dayGainLoss === null || stock.dayGainLoss === undefined || stock.watchOnly) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(stock.dayGainLoss);
  }

  private calculateStockDayChange(stock: StockAlert): number | null {
    if (stock.dayGainLoss === null || stock.dayGainLoss === undefined) {
      return null;
    }

    if (stock.watchOnly) {
      return stock.dayGainLoss;
    }

    if (stock.quantity === 0) {
      return null;
    }

    return stock.dayGainLoss / stock.quantity;
  }

  private isNoAlertReason(reason: string): boolean {
    return /^No watched (stock|position) alerts fired(?: under current thresholds)?\.?$/i.test(reason);
  }

  private formatTooltipMoney(value: number | null): string {
    if (value === null || Number.isNaN(value)) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected formatQuantity(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
  }

  private matchesPositionFilter(stock: StockAlert): boolean {
    if (this.positionFilter === 'positions') {
      return !stock.watchOnly;
    }

    if (this.positionFilter === 'watchlist') {
      return stock.watchOnly;
    }

    return true;
  }

  protected positionRowKey(stock: StockAlert): string {
    return String(stock.id ?? stock.symbol);
  }

  private resolveTotalValue(stock: StockAlert): number | null {
    if (stock.marketValue !== null && stock.marketValue !== undefined) {
      return stock.marketValue;
    }
    if (stock.latestPrice !== null && stock.latestPrice !== undefined) {
      return stock.latestPrice * stock.quantity;
    }
    return null;
  }

  private resolvePositionType(stock: StockAlert): string {
    const providedType = this.normalizeProvidedType(stock.positionType);
    if (providedType && providedType !== 'Other') {
      return providedType;
    }

    const symbol = stock.symbol?.trim().toUpperCase() ?? '';
    const company = stock.companyName?.trim().toLowerCase() ?? '';
    const haystack = `${symbol} ${company}`;

    if (this.isCryptoAsset(symbol, company)) return 'Crypto';
    if (/\b(reit|real estate|realty|properties|property trust|residential|commercial property|xlre|vnq|iyr)\b/.test(haystack)) return 'Real Estate';
    if (/\b(energy|oil|gas|petroleum|solar|uranium|renewable|pipeline|xle|vde|xop)\b/.test(haystack)) return 'Energy';
    if (/\b(software|semiconductor|technology|tech|cloud|ai|chip|micro|internet|data|cyber|xlk|vgt|smh|qqq)\b/.test(haystack)) return 'Tech';
    if (/\b(bank|financial|finance|insurance|capital|payment|fintech|xlf|kbe)\b/.test(haystack)) return 'Finance';
    if (/\b(health|pharma|biotech|medical|healthcare|drug|xlv)\b/.test(haystack)) return 'Healthcare';
    if (/\b(consumer|retail|apparel|restaurant|travel|discretionary|staples|xly|xlp)\b/.test(haystack)) return 'Consumer';
    if (/\b(industrial|aerospace|defense|transport|rail|machinery|xli)\b/.test(haystack)) return 'Industrial';
    if (/\b(telecom|media|communication|entertainment|xlc)\b/.test(haystack)) return 'Communication';
    if (/\b(material|mining|steel|chemical|gold|xlb)\b/.test(haystack)) return 'Materials';
    if (/\b(utility|electric|water|power grid|xlu)\b/.test(haystack)) return 'Utilities';

    return 'Other';
  }

  private normalizeProvidedType(type: string | null | undefined): string {
    const normalized = (type ?? '').trim().replace(/[_-]+/g, ' ');
    if (!normalized) {
      return '';
    }
    return normalized
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  private isCryptoAsset(symbol: string, companyLower: string): boolean {
    if (!symbol && !companyLower) {
      return false;
    }

    if (/\b(crypto|bitcoin|ethereum|blockchain|token|coin)\b/.test(companyLower)) {
      return true;
    }

    if (symbol.endsWith('-USD') || symbol.endsWith('USDT')) {
      return true;
    }

    return /^(BTC|ETH|SOL|XRP|ADA|DOGE|LTC|BNB|DOT|AVAX|MATIC|LINK|UNI)$/i.test(symbol);
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private formatTooltipRatio(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }

    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  private loadCollapsedState(): void {
    try {
      const raw = localStorage.getItem(this.collapsedStateStorageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) {
        return;
      }
      this.collapsedSymbols = new Set(parsed.map((value) => String(value).toUpperCase()));
    } catch {
      this.collapsedSymbols = new Set<string>();
    }
  }

  private persistCollapsedState(): void {
    const collapsed = Array.from(this.collapsedSymbols.values());
    localStorage.setItem(this.collapsedStateStorageKey, JSON.stringify(collapsed));
  }

  private positionChartCacheKey(stock: StockAlert): string {
    return `${stock.symbol.toUpperCase()}|${this.selectedChartRange(stock)}`;
  }

  private isGlobalRiskIndicator(indicator: IndicatorSnapshot): boolean {
    return indicator.id === 'vix' || indicator.id === 'credit' || indicator.id === 'fear-greed' || indicator.id === 'breadth' || indicator.id === 'correlation';
  }

  private globalRiskSortOrder(indicatorId: string): number {
    if (indicatorId === 'vix') return 0;
    if (indicatorId === 'fear-greed') return 1;
    if (indicatorId === 'credit') return 2;
    if (indicatorId === 'breadth') return 3;
    if (indicatorId === 'correlation') return 4;
    return 2;
  }

  private isGlobalRiskIndicatorOverThreshold(indicator: IndicatorSnapshot): boolean {
    const value = Number(indicator.value) || 0;
    const change = Number(indicator.change) || 0;
    if (indicator.id === 'fear-greed') {
      return value <= this.globalRiskValueThreshold(indicator);
    }

    if (indicator.id === 'breadth') {
      return value < this.globalRiskValueThreshold(indicator);
    }

    if (indicator.id === 'correlation') {
      return value >= this.globalRiskValueThreshold(indicator);
    }

    return value >= this.globalRiskValueThreshold(indicator) || change >= this.globalRiskChangeThreshold(indicator);
  }

  private globalRiskValueThreshold(indicator: IndicatorSnapshot): number {
    return this.globalRiskChartThreshold(indicator) ?? Number.POSITIVE_INFINITY;
  }

  private globalRiskChangeThreshold(indicator: IndicatorSnapshot): number {
    if (indicator.id === 'breadth') {
      return 0;
    }
    if (indicator.id === 'correlation') {
      return 0;
    }
    return indicator.id === 'credit' ? 0.15 : 3;
  }

  private asTrendChartRange(range: string): TrendChartRange {
    return this.chartRanges.includes(range as TrendChartRange) ? range as TrendChartRange : '1m';
  }

  private toTrendChartPoints(points: ChartPoint[]): TrendChartPoint[] {
    return points
      .map((point) => ({
        date: new Date(point.timestamp),
        value: Number(point.value),
      }))
      .filter((point) => !Number.isNaN(point.date.getTime()) && Number.isFinite(point.value));
  }

  private loadPositionChart(stock: StockAlert): void {
    const cacheKey = this.positionChartCacheKey(stock);
    const range = this.selectedChartRange(stock);
    if (this.chartCache.has(cacheKey) || this.loadingChartKeys.has(cacheKey)) {
      return;
    }

    this.loadingChartKeys.add(cacheKey);
    this.state.fetchStockHistory(this.state.username, this.state.password, stock.symbol, range)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loadingChartKeys.delete(cacheKey)),
      )
      .subscribe({
        next: (series) => {
          const points = (series.points || [])
            .map((point) => ({
              date: new Date(point.timestamp),
              value: Number(point.value),
            }))
            .filter((point) => !Number.isNaN(point.date.getTime()) && Number.isFinite(point.value));
          if (points.length) {
            this.chartCache.set(cacheKey, points);
          } else {
            this.chartCache.delete(cacheKey);
          }
        },
        error: () => {
          this.chartCache.delete(cacheKey);
        },
      });
  }
}
