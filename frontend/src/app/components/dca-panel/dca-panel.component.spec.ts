import { TestBed } from '@angular/core/testing';
import { MarketDashboardService } from '../../market-dashboard.service';
import { DcaPanelComponent } from './dca-panel.component';

describe('DcaPanelComponent', () => {
  function createState(overrides: Partial<MarketDashboardService> = {}): MarketDashboardService {
    return {
      isLoggedIn: true,
      isLoading: false,
      isLoadingDca: false,
      hasLoadedDcaSettings: false,
      telegramDcaEnabled: false,
      dcaReminderNote: '',
      ...overrides,
    } as MarketDashboardService;
  }

  async function render(state: MarketDashboardService) {
    await TestBed.configureTestingModule({
      imports: [DcaPanelComponent],
      providers: [{ provide: MarketDashboardService, useValue: state }],
    }).compileComponents();

    const fixture = TestBed.createComponent(DcaPanelComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a loading indicator while loading', async () => {
    const element = await render(createState({ isLoadingDca: true, hasLoadedDcaSettings: true }));
    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading DCA reminder settings...');
  });

  it('does not mask DCA settings for unrelated dashboard loading', async () => {
    const element = await render(createState({ isLoading: true, isLoadingDca: false, hasLoadedDcaSettings: true, dcaReminderNote: 'Buy monthly.' }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.textContent).toContain('Buy monthly.');
  });

  it('shows loading while loading settings after initial dashboard load', async () => {
    const element = await render(createState({ hasLoadedDcaSettings: false, isLoadingDca: true }));
    expect(element.querySelector('.section-loading .loading-spinner')).not.toBeNull();
    expect(element.textContent).toContain('Loading DCA reminder settings...');
  });

  it('renders default note when loaded but no reminder note is set', async () => {
    const element = await render(createState({ isLoading: false, isLoadingDca: false, hasLoadedDcaSettings: true, dcaReminderNote: '' }));

    expect(element.querySelector('.section-loading')).toBeNull();
    expect(element.textContent).toContain('No custom DCA note set yet.');
  });
});

