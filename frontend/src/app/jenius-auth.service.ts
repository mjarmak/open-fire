import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, isDevMode } from '@angular/core';
import { firstValueFrom, finalize, Observable, shareReplay, throwError } from 'rxjs';

export interface JeniusAuthUser {
  username: string;
  userId: string;
  email?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
}

interface TokenClaims {
  sub?: string;
  preferred_username?: string;
  email?: string;
  exp?: number;
}

export const JENIUS_AUTH_ENDPOINT =
  'https://auth.jeniusapps.com/auth/realms/jenius/protocol/openid-connect';
export const JENIUS_CLIENT_ID = 'open-fire';

const PKCE_VERIFIER_KEY = 'open.fire.pkce.verifier';
const DEV_ACCESS_TOKEN_KEY = 'open.fire.dev.access-token';
const OAUTH_STATE_KEY = 'open.fire.oauth.state';
const RETURN_URL_KEY = 'open.fire.oauth.return-url';

@Injectable({ providedIn: 'root' })
export class JeniusAuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private redirecting = false;
  private refreshRequest: Observable<TokenResponse> | null = null;

  constructor(private readonly http: HttpClient) {
    this.clearLegacyCredentials();
    if (isDevMode()) {
      this.accessToken = sessionStorage.getItem(DEV_ACCESS_TOKEN_KEY);
    }
  }

  async initialize(): Promise<JeniusAuthUser | null> {
    if (location.pathname === '/callback') {
      try {
        await this.completeAuthorization();
      } catch {
        await this.startLogin('/');
        return null;
      }
    }

    if (!this.accessToken) return null;
    return this.currentUser();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  isAccessTokenExpiring(): boolean {
    const claims = this.claims();
    return !claims?.exp || claims.exp * 1000 <= Date.now() + 15_000;
  }

  refreshAccessToken(): Observable<TokenResponse> {
    if (this.refreshRequest) return this.refreshRequest;
    if (!this.refreshToken) return throwError(() => new Error('Missing refresh token.'));

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: JENIUS_CLIENT_ID,
    });
    this.refreshRequest = this.http.post<TokenResponse>(
      `${JENIUS_AUTH_ENDPOINT}/token`, body.toString(), { headers: this.formHeaders() },
    ).pipe(
      shareReplay(1),
      finalize(() => this.refreshRequest = null),
    );
    this.refreshRequest.subscribe({
      next: (tokens) => this.storeTokens(tokens),
      error: () => this.clearTokens(),
    });
    return this.refreshRequest;
  }

  retryAuthorization(): void {
    void this.startLogin(location.pathname + location.search + location.hash);
  }

  startRegistration(returnUrl = '/'): Promise<void> {
    return this.startAuthorization(returnUrl, true);
  }

  startLogin(returnUrl = '/'): Promise<void> {
    return this.startAuthorization(returnUrl, false);
  }

  logout(): void {
    this.clearTokens();
    const parameters = new URLSearchParams({
      client_id: JENIUS_CLIENT_ID,
      post_logout_redirect_uri: location.origin + '/',
    });
    location.assign(`${JENIUS_AUTH_ENDPOINT}/logout?${parameters.toString()}`);
  }

  private async startAuthorization(returnUrl: string, register: boolean): Promise<void> {
    if (this.redirecting) return;
    this.redirecting = true;
    this.clearTokens();
    const verifier = this.base64Url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = this.base64Url(new Uint8Array(digest));
    const state = this.base64Url(crypto.getRandomValues(new Uint8Array(24)));
    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    sessionStorage.setItem(RETURN_URL_KEY, this.safeReturnUrl(returnUrl));
    const parameters = new URLSearchParams({
      client_id: JENIUS_CLIENT_ID,
      response_type: 'code',
      scope: 'openid profile email',
      redirect_uri: location.origin + '/callback',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    location.assign(`${JENIUS_AUTH_ENDPOINT}/${register ? 'registrations' : 'auth'}?${parameters.toString()}`);
  }

  private async completeAuthorization(): Promise<void> {
    const parameters = new URLSearchParams(location.search);
    const code = parameters.get('code');
    const state = parameters.get('state');
    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
    if (!code || !state || state !== expectedState || !verifier) {
      throw new Error('Invalid authorization callback.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code', code,
      redirect_uri: location.origin + '/callback',
      client_id: JENIUS_CLIENT_ID, code_verifier: verifier,
    });
    const tokens = await firstValueFrom(this.http.post<TokenResponse>(
      `${JENIUS_AUTH_ENDPOINT}/token`, body.toString(), { headers: this.formHeaders() },
    ));
    this.storeTokens(tokens);
    const returnUrl = this.safeReturnUrl(sessionStorage.getItem(RETURN_URL_KEY) || '/');
    this.clearAuthorizationRequest();
    history.replaceState({}, '', returnUrl);
  }

  private currentUser(): JeniusAuthUser | null {
    const claims = this.claims();
    if (!claims?.sub) return null;
    return {
      userId: claims.sub,
      username: claims.preferred_username || claims.email || claims.sub,
      email: claims.email,
    };
  }

  private claims(): TokenClaims | null {
    if (!this.accessToken) return null;
    try {
      const payload = this.accessToken.split('.')[1];
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(normalized)) as TokenClaims;
    } catch {
      return null;
    }
  }

  private storeTokens(tokens: TokenResponse): void {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token || this.refreshToken;
    this.redirecting = false;
  }

  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    if (isDevMode()) {
      sessionStorage.removeItem(DEV_ACCESS_TOKEN_KEY);
    }
  }

  private clearAuthorizationRequest(): void {
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(RETURN_URL_KEY);
  }

  private clearLegacyCredentials(): void {
    localStorage.removeItem('sma_username');
    localStorage.removeItem('sma_password');
    localStorage.removeItem('sma_remember_login');
    document.cookie = 'sma_username=; Max-Age=0; Path=/; SameSite=Lax';
    document.cookie = 'sma_password=; Max-Age=0; Path=/; SameSite=Lax';
  }

  private safeReturnUrl(value: string): string {
    return value.startsWith('/') && !value.startsWith('//') && value !== '/callback' ? value : '/';
  }

  private formHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
  }

  private base64Url(bytes: Uint8Array): string {
    const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
