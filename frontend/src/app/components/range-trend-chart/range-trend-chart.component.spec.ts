import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RangeTrendChartComponent } from './range-trend-chart.component';

describe('RangeTrendChartComponent', () => {
  async function render(): Promise<{
    fixture: ComponentFixture<RangeTrendChartComponent>;
    element: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [RangeTrendChartComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(RangeTrendChartComponent);
    fixture.componentInstance.points = [
      { date: new Date('2026-05-01T12:00:00Z'), value: 22 },
      { date: new Date('2026-06-01T12:00:00Z'), value: 25 },
      { date: new Date('2026-07-01T12:00:00Z'), value: 24 },
    ];
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('uses a shorter viewport with smaller axis labels', async () => {
    const { element } = await render();
    const svg = element.querySelector<SVGElement>('.range-trend-svg');
    const yLabel = element.querySelector<SVGTextElement>('.trend-y-axis-label');
    const xLabel = element.querySelector<SVGTextElement>('.trend-x-axis-label');

    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 104');
    expect(yLabel?.getAttribute('font-size')).toBe('10');
    expect(xLabel?.getAttribute('font-size')).toBe('10');
  });

  it('shows the y-axis unit once while keeping y-axis ticks numeric', async () => {
    const { fixture, element } = await render();
    fixture.componentInstance.valueMode = 'number';
    fixture.componentInstance.unit = 'spread %';
    fixture.detectChanges();

    expect(element.querySelector('.trend-y-axis-unit')?.textContent?.trim()).toBe('spread %');
    const yAxisLabels = Array.from(element.querySelectorAll('.trend-y-axis-label'))
      .map((label) => label.textContent?.trim() || '');
    expect(yAxisLabels.length).toBeGreaterThan(0);
    expect(yAxisLabels.every((label) => label && !label.includes('spread'))).toBeTrue();
    expect(yAxisLabels.every((label) => /^-?[\d,.]+[KMBT]?$/.test(label))).toBeTrue();
  });

  it('does not use the global projection stroke draw animation for the trend line', async () => {
    const { element } = await render();
    const trendLine = element.querySelector<SVGPathElement>('.range-trend-svg .trend-line');

    expect(trendLine).not.toBeNull();
    expect(trendLine?.classList.contains('no-draw-animation')).toBeTrue();
  });

  it('shows the nearest point value in a hover tooltip', async () => {
    const { fixture, element } = await render();
    const container = element.querySelector<HTMLElement>('.range-trend-container');
    expect(container).not.toBeNull();

    spyOn(container!, 'getBoundingClientRect').and.returnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 120,
      width: 400,
      height: 120,
      toJSON: () => ({}),
    } as DOMRect);

    container?.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 200,
      clientY: 55,
    }));
    fixture.detectChanges();

    const tooltip = element.querySelector<HTMLElement>('.range-trend-tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain('Jun 1, 2026');
    expect(tooltip?.textContent).toContain('$25');
    expect(element.querySelector('.trend-hover-dot')).not.toBeNull();

    container?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('.range-trend-tooltip')).toBeNull();
  });
});
