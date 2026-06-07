import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject } from '@angular/core';

export type TrendChartRange = '1h' | '1d' | '5d' | '1m' | '1y' | '5y' | 'all';

export type TrendChartPoint = {
  date: Date;
  value: number;
};

type AxisTick = {
  x?: number;
  y?: number;
  label: string;
};

type ChartRenderPoint = {
  x: number;
  y: number;
  source: TrendChartPoint;
};

@Component({
  selector: 'app-range-trend-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './range-trend-chart.component.html',
})
export class RangeTrendChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  @ViewChild('chartContainer') private chartContainer?: ElementRef<HTMLElement>;

  protected viewBoxWidth = 640;
  protected readonly viewBoxHeight = 104;
  protected readonly startY = 12;
  protected readonly endY = 72;
  protected readonly xAxisLabelY = 96;
  protected readonly axisFontSize = 10;
  private resizeObserver?: ResizeObserver;

  @Input() points: TrendChartPoint[] = [];
  @Input() ranges: readonly TrendChartRange[] = ['1h', '1d', '5d', '1m', '1y', '5y', 'all'];
  @Input() selectedRange: TrendChartRange = '1m';
  @Input() tone: 'up' | 'down' | 'flat' = 'flat';
  @Input() label = 'Trend chart';
  @Input() valueMode: 'currency' | 'number' = 'currency';
  @Input() unit = '';
  @Input() loading = false;

  @Output() rangeChange = new EventEmitter<TrendChartRange>();

  protected hoveredPoint: ChartRenderPoint | null = null;
  protected hoverTooltipLeft = 0;
  protected hoverTooltipTop = 0;
  private destroyed = false;

  protected get startX(): number {
    return this.viewBoxWidth < 420 ? 48 : 58;
  }

  protected get endX(): number {
    return Math.max(this.startX + 1, this.viewBoxWidth - 24);
  }

  protected get yAxisLabelX(): number {
    return this.startX - 8;
  }

  protected get yAxisUnitLabel(): string {
    if (this.valueMode === 'currency') {
      return 'USD';
    }
    return this.unit.trim();
  }

  ngAfterViewInit(): void {
    this.scheduleViewBoxUpdate();
    if (typeof ResizeObserver === 'undefined' || !this.chartContainer) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleViewBoxUpdate();
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loading']?.currentValue) {
      this.hoveredPoint = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizeObserver?.disconnect();
  }

  get yAxisTicks(): AxisTick[] {
    const { min, max } = this.valueRange;
    const span = Math.max(0.001, max - min);
    return [1, 0.75, 0.5, 0.25, 0].map((ratio) => {
      const value = min + span * ratio;
      return {
        y: this.chartYForValue(value),
        label: this.formatAxisValue(value),
      };
    });
  }

  get xAxisTicks(): AxisTick[] {
    const source = this.points.filter((point) => Number.isFinite(point.value));
    if (!source.length) {
      return [];
    }

    const indexes = Array.from(new Set([
      0,
      Math.floor((source.length - 1) / 2),
      source.length - 1,
    ]));

    return indexes.map((index) => ({
      x: this.chartXForIndex(index, source.length),
      label: this.formatDate(source[index].date),
    }));
  }

  get svgPath(): string {
    return this.chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');
  }

  get svgAreaPath(): string {
    const points = this.chartPoints;
    if (!points.length) {
      return '';
    }

    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(' ');
    const last = points[points.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${this.endY} L ${this.startX} ${this.endY} Z`;
  }

  get hasPoints(): boolean {
    return this.chartPoints.length > 1;
  }

  get emptyMessage(): string {
    return this.loading ? 'Loading real market history...' : 'No historical data for this range';
  }

  get emptyLabelX(): number {
    return this.viewBoxWidth / 2;
  }

  get emptyLabelY(): number {
    return this.startY + (this.endY - this.startY) / 2;
  }

  selectRange(range: TrendChartRange, event: Event): void {
    event.stopPropagation();
    this.rangeChange.emit(range);
  }

  protected onChartMouseMove(event: MouseEvent): void {
    if (this.loading) {
      this.hoveredPoint = null;
      return;
    }

    const points = this.chartPoints;
    if (!points.length) {
      this.hoveredPoint = null;
      return;
    }

    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const svgX = this.clamp((mouseX / Math.max(1, rect.width)) * this.viewBoxWidth, this.startX, this.endX);
    const nearest = points.reduce((closest, point) =>
      Math.abs(point.x - svgX) < Math.abs(closest.x - svgX) ? point : closest,
    );

    const pointLeft = (nearest.x / this.viewBoxWidth) * rect.width;
    const pointTop = (nearest.y / this.viewBoxHeight) * rect.height;
    this.hoveredPoint = nearest;
    this.hoverTooltipLeft = this.clamp(pointLeft + 12, 8, Math.max(8, rect.width - 178));
    this.hoverTooltipTop = this.clamp(pointTop - 44, 8, Math.max(8, rect.height - 72));
  }

  protected onChartMouseLeave(): void {
    this.hoveredPoint = null;
  }

  protected formatTooltipDate(date: Date): string {
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    if (this.selectedRange === '1h' || this.selectedRange === '1d') {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(safeDate);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(safeDate);
  }

  protected formatTooltipValue(value: number): string {
    return this.formatValue(value);
  }

  private get chartPoints(): ChartRenderPoint[] {
    const source = this.points.filter((point) => Number.isFinite(point.value));
    return source.map((point, index) => ({
      x: this.chartXForIndex(index, source.length),
      y: this.chartYForValue(point.value),
      source: point,
    }));
  }

  private get valueRange(): { min: number; max: number } {
    const values = this.points
      .map((point) => point.value)
      .filter((value) => Number.isFinite(value));

    if (!values.length) {
      return { min: 0, max: 1 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) {
      const offset = Math.max(1, Math.abs(max) * 0.08);
      return { min: min - offset, max: max + offset };
    }

    const padding = (max - min) * 0.12;
    return { min: Math.max(0, min - padding), max: max + padding };
  }

  private chartXForIndex(index: number, count: number): number {
    if (count <= 1) {
      return this.startX;
    }
    return this.startX + (index / (count - 1)) * (this.endX - this.startX);
  }

  private chartYForValue(value: number): number {
    const { min, max } = this.valueRange;
    const span = Math.max(0.001, max - min);
    const ratio = (value - min) / span;
    return this.endY - ratio * (this.endY - this.startY);
  }

  private formatValue(value: number): string {
    if (this.valueMode === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    }

    const formatted = new Intl.NumberFormat('en-US', {
      notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 2,
    }).format(value);
    return this.unit ? `${formatted} ${this.unit}` : formatted;
  }

  private formatAxisValue(value: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: this.valueMode === 'currency' ? 1 : 2,
    }).format(value);
  }

  private formatDate(date: Date): string {
    const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
    if (this.selectedRange === '1h' || this.selectedRange === '1d') {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }).format(safeDate);
    }

    if (this.selectedRange === '1y' || this.selectedRange === '5y' || this.selectedRange === 'all') {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: '2-digit',
      }).format(safeDate);
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(safeDate);
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.min(max, Math.max(min, value));
  }

  private updateViewBoxWidth(): boolean {
    const width = this.chartContainer?.nativeElement.getBoundingClientRect().width || 0;
    if (width <= 0) {
      return false;
    }

    const nextWidth = Math.max(280, Math.min(1600, Math.round(width)));
    if (nextWidth === this.viewBoxWidth) {
      return false;
    }

    this.viewBoxWidth = nextWidth;
    return true;
  }

  private scheduleViewBoxUpdate(): void {
    setTimeout(() => {
      if (this.destroyed) {
        return;
      }
      if (this.updateViewBoxWidth()) {
        this.changeDetectorRef.detectChanges();
      }
    });
  }
}
