import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, inject, Output } from '@angular/core';
import { StockAlert } from '../../market-dashboard.models';
import { MarketDashboardService } from '../../market-dashboard.service';

type PositionTypeSlice = {
  label: string;
  value: number;
  percent: number;
  color: string;
  count: number;
};

@Component({
  selector: 'app-portfolio-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portfolio-board.component.html',
})
export class PortfolioBoardComponent implements OnInit {
  protected readonly state = inject(MarketDashboardService);
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
  @Output() deletePosition = new EventEmitter<string>();
  collapsedSymbols = new Set<string>();

  ngOnInit(): void {
    this.loadCollapsedState();
  }

  get displayedStocks(): StockAlert[] {
    return [...this.state.stocks].sort((left, right) => {
      if (left.watchOnly !== right.watchOnly) {
        return left.watchOnly ? 1 : -1;
      }
      return left.symbol.localeCompare(right.symbol);
    });
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
      return `${stock.symbol} - ${companyName}\nx${position} | Total: ${totalValue}`;
    });

    return lines.join('\n\n');
  }

  isCollapsed(stock: StockAlert): boolean {
    if (stock.watchOnly) {
      return false;
    }
    return this.collapsedSymbols.has(stock.symbol.toUpperCase());
  }

  toggleCollapsed(stock: StockAlert): void {
    if (stock.watchOnly) {
      this.collapsedSymbols.delete(stock.symbol.toUpperCase());
      this.persistCollapsedState();
      return;
    }

    const symbol = stock.symbol.toUpperCase();
    if (this.collapsedSymbols.has(symbol)) {
      this.collapsedSymbols.delete(symbol);
    } else {
      this.collapsedSymbols.add(symbol);
    }
    this.persistCollapsedState();
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

  private formatQuantity(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '-';
    }
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
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
}
