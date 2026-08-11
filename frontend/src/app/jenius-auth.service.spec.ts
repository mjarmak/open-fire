import { HttpClient } from '@angular/common/http';
import { JeniusAuthService } from './jenius-auth.service';

describe('JeniusAuthService', () => {
  it('allows another authentication redirect after returning with browser Back', () => {
    const service = new JeniusAuthService({} as HttpClient);
    const redirectState = service as unknown as { redirecting: boolean };
    redirectState.redirecting = true;

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(redirectState.redirecting).toBeFalse();
  });
});
