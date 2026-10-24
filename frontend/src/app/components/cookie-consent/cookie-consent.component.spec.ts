import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { CookieConsentComponent } from './cookie-consent.component';

describe('Shared consent dialog integration', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.cookie = 'jenius-consent-v2-open-fire=; Max-Age=0; Path=/';
    document.cookie = 'jeniusapps-analytics-consent=; Max-Age=0; Path=/';
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, CookieConsentComponent],
      
    }).compileComponents();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    document.cookie = 'jenius-consent-v2-open-fire=; Max-Age=0; Path=/';
  });
  it('mounts the package and offers cookies without enabling analytics', () => {
    const fixture = TestBed.createComponent(CookieConsentComponent);
    fixture.detectChanges();
    const root = (fixture.nativeElement as HTMLElement).shadowRoot!;
    expect(Array.from(root.querySelectorAll('[data-choice]')).map(button => button.textContent)).toEqual(['No thanks', 'Only Cookies', 'Allow Cookies & Analytics']);
    (root.querySelector('[data-choice="cookies"]') as HTMLButtonElement).click();
    expect(document.getElementById('jeniusapps-google-analytics')).toBeNull();
    expect((root.querySelector('.consent-card') as HTMLElement).hidden).toBeTrue();
    expect(root.querySelector('.settings')).toBeNull();
  });
});
