import { HttpClient } from '@angular/common/http';
import { JeniusAuthService } from './jenius-auth.service';

describe('JeniusAuthService', () => {
  beforeEach(() => sessionStorage.clear());

  afterEach(() => sessionStorage.clear());

  it('allows another authentication redirect after returning with browser Back', () => {
    const service = new JeniusAuthService({} as HttpClient);
    const redirectState = service as unknown as { redirecting: boolean };
    redirectState.redirecting = true;

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));

    expect(redirectState.redirecting).toBeFalse();
  });

  it('restores the authenticated user after a page refresh', async () => {
    const claims = btoa(JSON.stringify({
      sub: 'jenius-user-id',
      preferred_username: 'test-user',
      exp: Math.floor(Date.now() / 1000) + 300,
    }));
    const accessToken = `header.${claims}.signature`;
    const service = new JeniusAuthService({} as HttpClient);
    const tokenStore = service as unknown as {
      storeTokens(tokens: { access_token: string; refresh_token?: string }): void;
    };
    tokenStore.storeTokens({ access_token: accessToken, refresh_token: 'refresh-token' });

    const refreshedService = new JeniusAuthService({} as HttpClient);

    expect(refreshedService.getAccessToken()).toBe(accessToken);
    await expectAsync(refreshedService.initialize()).toBeResolvedTo({
      userId: 'jenius-user-id',
      username: 'test-user',
      email: undefined,
    });
  });
});
