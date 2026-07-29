import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { jeniusAuthInterceptor } from './jenius-auth.interceptor';
import { JeniusAuthService } from './jenius-auth.service';

describe('jeniusAuthInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: jasmine.SpyObj<JeniusAuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<JeniusAuthService>(
      'JeniusAuthService',
      ['getAccessToken', 'isAccessTokenExpiring', 'refreshAccessToken', 'retryAuthorization'],
    );
    auth.getAccessToken.and.returnValue('jenius-access-token');
    auth.isAccessTokenExpiring.and.returnValue(false);
    auth.refreshAccessToken.and.returnValue(of({ access_token: 'refreshed-token' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jeniusAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: JeniusAuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('adds the Jenius bearer token to API requests', () => {
    http.get('/api/dashboard').subscribe();

    const request = controller.expectOne('/api/dashboard');
    expect(request.request.headers.get('Authorization')).toBe('Bearer jenius-access-token');
    request.flush({});
  });

  it('does not send the token to external providers', () => {
    http.get('https://example.com/data').subscribe();

    const request = controller.expectOne('https://example.com/data');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });
});
