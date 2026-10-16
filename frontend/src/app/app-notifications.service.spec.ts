import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SwPush } from '@angular/service-worker';
import { Subject, of } from 'rxjs';
import { AppNotificationsService } from './app-notifications.service';

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let http: HttpTestingController;
  let push: jasmine.SpyObj<SwPush>;
  let subscription: PushSubscription;
  const preferences = { dca: true, briefing: true, returnReminder: true };
  beforeEach(() => {
    localStorage.removeItem('open-fire.push.owner');
    subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/device',
      toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/device', keys: { p256dh: 'key', auth: 'auth' } }),
      unsubscribe: jasmine.createSpy('unsubscribe').and.resolveTo(true) } as unknown as PushSubscription;
    push = jasmine.createSpyObj<SwPush>('SwPush', ['requestSubscription'], {
      isEnabled: true, subscription: of(null), notificationClicks: new Subject(),
    });
    push.requestSubscription.and.resolveTo(subscription);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: SwPush, useValue: push }] });
    service = TestBed.inject(AppNotificationsService); http = TestBed.inject(HttpTestingController);
    spyOnProperty(service, 'supported', 'get').and.returnValue(true);
    spyOnProperty(service, 'blocked', 'get').and.returnValue(false);
  });
  afterEach(() => http.verify());

  it('does not request permission on app launch', fakeAsync(() => {
    void service.initialize('alice-id');
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences });
    flushMicrotasks(); expect(push.requestSubscription).not.toHaveBeenCalled(); expect(service.enabledOnDevice).toBeFalse();
  }));

  it('enables only after user action and stores an account-owned subscription', fakeAsync(() => {
    void service.initialize('alice-id');
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences }); flushMicrotasks();
    void service.enable(); flushMicrotasks();
    expect(push.requestSubscription).toHaveBeenCalledOnceWith({ serverPublicKey: 'vapid' });
    http.expectOne({ method: 'PUT', url: '/api/notifications/app/settings' }).flush(null); flushMicrotasks();
    const request = http.expectOne({ method: 'POST', url: '/api/notifications/app/subscriptions' });
    expect(request.request.body).toEqual(subscription.toJSON()); request.flush(null); flushMicrotasks();
    expect(localStorage.getItem('open-fire.push.owner')).toBe('alice-id'); expect(service.enabledOnDevice).toBeTrue();
  }));

  it('revokes a subscription if API registration fails', fakeAsync(() => {
    service.configured = true; service.preferences = preferences;
    void service.enable(); flushMicrotasks();
    http.expectOne('/api/notifications/app/settings').flush(null); flushMicrotasks();
    http.expectOne('/api/notifications/app/subscriptions').flush({}, { status: 503, statusText: 'Unavailable' }); flushMicrotasks();
    expect(subscription.unsubscribe).toHaveBeenCalled(); expect(service.enabledOnDevice).toBeFalse(); expect(service.error).toContain('try again');
  }));

  it('does not inherit notifications from another account', fakeAsync(() => {
    Object.defineProperty(push, 'subscription', { get: () => of(subscription) });
    localStorage.setItem('open-fire.push.owner', 'bob-id');
    void service.initialize('alice-id');
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences }); flushMicrotasks();
    expect(subscription.unsubscribe).toHaveBeenCalled(); http.expectNone('/api/notifications/app/subscriptions');
    expect(service.enabledOnDevice).toBeFalse(); expect(localStorage.getItem('open-fire.push.owner')).toBeNull();
  }));

  it('shows permission denial without registering an endpoint', fakeAsync(() => {
    service.configured = true; service.preferences = preferences;
    (Object.getOwnPropertyDescriptor(service, 'blocked')!.get as jasmine.Spy).and.returnValue(true);
    void service.enable(); flushMicrotasks();
    expect(service.error).toContain('blocked'); expect(push.requestSubscription).not.toHaveBeenCalled();
  }));

  it('revokes locally on logout even when backend cleanup fails', fakeAsync(() => {
    Object.defineProperty(push, 'subscription', { get: () => of(subscription) });
    service.enabledOnDevice = true; localStorage.setItem('open-fire.push.owner', 'alice-id');
    void service.detach(); flushMicrotasks();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    const request = http.expectOne({ method: 'DELETE', url: '/api/notifications/app/subscriptions' });
    expect(request.request.body.endpoint).toEqual(subscription.endpoint);
    request.flush({}, { status: 503, statusText: 'Unavailable' }); flushMicrotasks();
    expect(service.enabledOnDevice).toBeFalse(); expect(localStorage.getItem('open-fire.push.owner')).toBeNull();
  }));

  it('loads an inbox without push support and preserves complete message text', fakeAsync(() => {
    (Object.getOwnPropertyDescriptor(service, 'supported')!.get as jasmine.Spy).and.returnValue(false);
    void service.show();
    http.expectOne('/api/notifications/app/settings').flush({ configured: false, publicKey: '', preferences });
    http.expectOne('/api/notifications/app').flush([{ id: 1, title: 'DCA', body: '<b>Literal user note</b>', createdAt: '2026-10-16T14:00:00Z' }]);
    flushMicrotasks(); expect(service.messages[0].body).toBe('<b>Literal user note</b>'); expect(service.loading).toBeFalse();
  }));
});
