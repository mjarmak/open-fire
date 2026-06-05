import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MarketDashboardService } from '../../market-dashboard.service';
import { AddPositionDialogComponent } from './add-position-dialog.component';

describe('AddPositionDialogComponent', () => {
  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      addDialogOpen: true,
      symbolQuery: '',
      symbolSuggestions: [],
      showSymbolDropdown: false,
      symbolMessage: 'Start typing and choose a stock, crypto, or currency from the dropdown.',
      holdingForm: {
        id: null,
        symbol: '',
        companyName: '',
        quantity: 0,
        averageCost: 0,
        watchOnly: false,
      },
      canSaveHolding: false,
      isSavingHolding: false,
      setHoldingWatchOnly: jasmine.createSpy('setHoldingWatchOnly'),
      ...overrides,
    } as unknown as MarketDashboardService;
  }

  async function render(state = createState()): Promise<{
    fixture: ComponentFixture<AddPositionDialogComponent>;
    element: HTMLElement;
  }> {
    await TestBed.configureTestingModule({
      imports: [AddPositionDialogComponent],
      providers: [
        { provide: MarketDashboardService, useValue: state },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AddPositionDialogComponent);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('does not emit close when the backdrop is clicked', async () => {
    const { fixture, element } = await render();
    const closeSpy = jasmine.createSpy('close');
    fixture.componentInstance.closeDialog.subscribe(closeSpy);

    element.querySelector<HTMLElement>('.modal-backdrop')?.click();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('still emits close from explicit close controls', async () => {
    const { fixture, element } = await render();
    const closeSpy = jasmine.createSpy('close');
    fixture.componentInstance.closeDialog.subscribe(closeSpy);

    element.querySelector<HTMLButtonElement>('.dialog-heading .icon-action')?.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
