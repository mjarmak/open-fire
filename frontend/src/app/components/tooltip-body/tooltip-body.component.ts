import { CommonModule, DOCUMENT } from '@angular/common';
import { AfterViewChecked, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';

type TooltipPlacement = 'above' | 'below';

@Component({
  selector: 'app-tooltip-body',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tooltip-body.component.html',
  styleUrl: './tooltip-body.component.scss',
})
export class TooltipBodyComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('tooltipBody') private tooltipBody?: ElementRef<HTMLElement>;

  private readonly document = inject(DOCUMENT);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private activeTarget: HTMLElement | null = null;
  private needsPositionUpdate = false;
  private readonly teardownListeners: Array<() => void> = [];

  protected visible = false;
  protected text = '';
  protected left = 0;
  protected top = 0;
  protected placement: TooltipPlacement = 'above';

  constructor() {
    this.listen(this.document, 'pointerover', (event) => this.handlePointerOver(event));
    this.listen(this.document, 'pointerout', (event) => this.handlePointerOut(event));
    this.listen(this.document, 'focusin', (event) => this.handleFocusIn(event));
    this.listen(this.document, 'focusout', (event) => this.handleFocusOut(event));
    this.listen(window, 'resize', () => this.repositionOrHide());
    this.listen(this.document, 'scroll', () => this.repositionOrHide(), true);
  }

  ngAfterViewChecked(): void {
    if (!this.needsPositionUpdate) {
      return;
    }
    this.needsPositionUpdate = false;
    this.positionTooltip();
  }

  ngOnDestroy(): void {
    for (const teardown of this.teardownListeners) {
      teardown();
    }
  }

  private handlePointerOver(event: Event): void {
    const target = this.tooltipTargetFromEvent(event);
    if (target) {
      this.show(target);
    }
  }

  private handlePointerOut(event: Event): void {
    if (!this.activeTarget) {
      return;
    }

    const relatedTarget = (event as PointerEvent).relatedTarget;
    if (relatedTarget instanceof Node && this.activeTarget.contains(relatedTarget)) {
      return;
    }

    this.hide();
  }

  private handleFocusIn(event: Event): void {
    const target = this.tooltipTargetFromEvent(event);
    if (target) {
      this.show(target);
    }
  }

  private handleFocusOut(event: Event): void {
    const relatedTarget = (event as FocusEvent).relatedTarget;
    if (this.activeTarget && relatedTarget instanceof Node && this.activeTarget.contains(relatedTarget)) {
      return;
    }
    this.hide();
  }

  private tooltipTargetFromEvent(event: Event): HTMLElement | null {
    const eventTarget = event.target instanceof Element ? event.target : null;
    const tooltipTarget = eventTarget?.closest<HTMLElement>('[data-tooltip]');
    const tooltipText = tooltipTarget?.getAttribute('data-tooltip')?.trim();
    return tooltipTarget && tooltipText ? tooltipTarget : null;
  }

  private show(target: HTMLElement): void {
    this.activeTarget = target;
    this.text = target.getAttribute('data-tooltip')?.trim() || '';
    this.visible = true;
    this.needsPositionUpdate = true;
    this.changeDetector.detectChanges();
  }

  private hide(): void {
    if (!this.visible && !this.activeTarget) {
      return;
    }

    this.activeTarget = null;
    this.visible = false;
    this.text = '';
    this.changeDetector.detectChanges();
  }

  private repositionOrHide(): void {
    if (!this.activeTarget || !this.visible) {
      return;
    }

    if (!this.document.documentElement.contains(this.activeTarget)) {
      this.hide();
      return;
    }

    this.needsPositionUpdate = true;
    this.changeDetector.detectChanges();
  }

  private positionTooltip(): void {
    const target = this.activeTarget;
    const tooltip = this.tooltipBody?.nativeElement;
    if (!target || !tooltip) {
      return;
    }

    const margin = 8;
    const gap = 10;
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preferBelow = target.classList.contains('app-tooltip-below');
    const topAbove = targetRect.top - tooltipRect.height - gap;
    const topBelow = targetRect.bottom + gap;
    const canFitAbove = topAbove >= margin;
    const canFitBelow = topBelow + tooltipRect.height <= viewportHeight - margin;

    if (preferBelow && canFitBelow) {
      this.placement = 'below';
    } else if (!preferBelow && canFitAbove) {
      this.placement = 'above';
    } else if (canFitBelow) {
      this.placement = 'below';
    } else {
      this.placement = 'above';
    }

    const unclampedLeft = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    const unclampedTop = this.placement === 'below' ? topBelow : topAbove;
    this.left = this.clamp(unclampedLeft, margin, viewportWidth - tooltipRect.width - margin);
    this.top = this.clamp(unclampedTop, margin, viewportHeight - tooltipRect.height - margin);
    this.changeDetector.detectChanges();
  }

  private clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }

  private listen(target: Document | Window, type: string, listener: EventListener, useCapture = false): void {
    target.addEventListener(type, listener, useCapture);
    this.teardownListeners.push(() => target.removeEventListener(type, listener, useCapture));
  }
}
