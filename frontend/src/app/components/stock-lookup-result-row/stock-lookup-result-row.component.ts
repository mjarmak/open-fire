import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SymbolSearchResult } from '../../market-dashboard.models';

@Component({
  selector: 'app-stock-lookup-result-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stock-lookup-result-row.component.html',
  host: {
    class: 'stock-row stock-lookup-result-row',
  },
})
export class StockLookupResultRowComponent {
  @Input({ required: true }) result!: SymbolSearchResult;
  @Output() add = new EventEmitter<SymbolSearchResult>();

  protected addResult(): void {
    this.add.emit(this.result);
  }

  protected get isCryptoResult(): boolean {
    const symbol = this.result.symbol?.trim().toUpperCase() ?? '';
    const region = this.result.region?.trim().toLowerCase() ?? '';
    return region.includes('crypto')
      || symbol.startsWith('BINANCE:')
      || symbol.endsWith('-USD')
      || symbol.endsWith('USDT');
  }

  protected formatPrice(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected formatMarketCap(value: number | null | undefined): string {
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
