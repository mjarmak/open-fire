import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AppNotificationsService } from '../../app-notifications.service';
import { AppNotificationsDialogComponent } from './app-notifications-dialog.component';

describe('AppNotificationsDialogComponent', () => {
  for (const enabledOnDevice of [false, true]) {
    it(`shows only settings with device enabled=${enabledOnDevice}`, async () => {
      await TestBed.configureTestingModule({
        imports: [AppNotificationsDialogComponent],
        providers: [provideNoopAnimations(), { provide: AppNotificationsService, useValue: {
          open: true, configured: true, supported: true, enabledOnDevice,
          preferences: { dca: true, briefing: false, returnReminder: false },
        } }],
      }).compileComponents();
      const fixture = TestBed.createComponent(AppNotificationsDialogComponent);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelectorAll('input[type="checkbox"]').length).toBe(3);
      expect(root.querySelector('[role="tablist"]')).toBeNull();
      expect(root.querySelector('.notification-inbox')).toBeNull();
      expect(root.querySelector('.notification-error')).toBeNull();
      expect(root.textContent).not.toContain('Test notification');
      expect(root.textContent).toContain(enabledOnDevice ? 'Disable on this device' : 'Enable on this device');
    });
  }
});
