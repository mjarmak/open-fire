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
  let feedback: { message: string; tone: 'neutral' | 'error' }[];
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
    feedback = [];
    service.feedback.subscribe(message => feedback.push(message));
    spyOnProperty(service, 'supported', 'get').and.returnValue(true);
    spyOnProperty(service, 'blocked', 'get').and.returnValue(false);
  });
  afterEach(() => http.verify());

  it('does not request permission on app launch', fakeAsync(() => {
    void service.initialize('alice-id');
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences });
    flushMicrotasks(); expect(push.requestSubscription).not.toHaveBeenCalled(); expect(service.enabledOnDevice).toBeFalse();
  }));

  it('defaults categories on but asks for browser permission only from enable', fakeAsync(() => {
    expect(service.preferences).toEqual(preferences);
    expect(service.enabledOnDevice).toBeFalse();
    void service.show();
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences });
    flushMicrotasks();
    void service.save();
    http.expectOne('/api/notifications/app/settings').flush(null); flushMicrotasks();
    expect(push.requestSubscription).not.toHaveBeenCalled();
    http.expectNone('/api/notifications/app/subscriptions');
  }));

  it('preserves saved category opt-outs', fakeAsync(() => {
    void service.show();
    const saved = { dca: false, briefing: true, returnReminder: false };
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences: saved });
    flushMicrotasks(); expect(service.preferences).toEqual(saved);
    expect(push.requestSubscription).not.toHaveBeenCalled();
  }));

  it('does not register a device if the user rejects the browser permission request', fakeAsync(() => {
    service.configured = true;
    push.requestSubscription.and.rejectWith(new DOMException('Permission denied', 'NotAllowedError'));
    void service.enable(); flushMicrotasks();
    expect(push.requestSubscription).toHaveBeenCalledTimes(1);
    expect(service.enabledOnDevice).toBeFalse();
    expect(service.preferences).toEqual(preferences);
    http.expectNone('/api/notifications/app/subscriptions');
    http.expectNone('/api/notifications/app/settings');
    expect(feedback[0].tone).toBe('error');
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
    expect(feedback).toEqual([{ message: 'Notifications enabled on this device.', tone: 'neutral' }]);
  }));

  it('revokes a subscription if API registration fails', fakeAsync(() => {
    service.configured = true; service.preferences = preferences;
    void service.enable(); flushMicrotasks();
    http.expectOne('/api/notifications/app/settings').flush(null); flushMicrotasks();
    http.expectOne('/api/notifications/app/subscriptions').flush({}, { status: 503, statusText: 'Unavailable' }); flushMicrotasks();
    expect(subscription.unsubscribe).toHaveBeenCalled(); expect(service.enabledOnDevice).toBeFalse();
    expect(feedback[0].message).toContain('try again'); expect(feedback[0].tone).toBe('error');
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
    expect(feedback[0].message).toContain('blocked'); expect(feedback[0].tone).toBe('error');
    expect(push.requestSubscription).not.toHaveBeenCalled();
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

  it('opens settings directly without requesting the removed inbox', fakeAsync(() => {
    (Object.getOwnPropertyDescriptor(service, 'supported')!.get as jasmine.Spy).and.returnValue(false);
    void service.show();
    http.expectOne('/api/notifications/app/settings').flush({ configured: false, publicKey: '', preferences });
    http.expectNone('/api/notifications/app');
    flushMicrotasks(); expect(service.open).toBeTrue(); expect(service.preferences).toEqual(preferences);
    expect(service.loading).toBeFalse(); expect(feedback).toEqual([]);
  }));

  it('reports a settings load failure and allows retry', fakeAsync(() => {
    void service.show();
    http.expectOne('/api/notifications/app/settings').flush({}, { status: 503, statusText: 'Unavailable' });
    flushMicrotasks();
    expect(service.loadFailed).toBeTrue(); expect(service.loading).toBeFalse();
    expect(feedback).toEqual([{ message: 'Could not load notification settings. Try again.', tone: 'error' }]);
    void service.show();
    http.expectOne('/api/notifications/app/settings').flush({ configured: true, publicKey: 'vapid', preferences });
    flushMicrotasks(); expect(service.loadFailed).toBeFalse(); expect(service.loading).toBeFalse();
  }));

  it('reports save success and failure through snackbar feedback', fakeAsync(() => {
    service.preferences = preferences;
    void service.save();
    const request = http.expectOne({ method: 'PUT', url: '/api/notifications/app/settings' });
    expect(request.request.body).toEqual(preferences); request.flush(null); flushMicrotasks();
    expect(feedback[0]).toEqual({ message: 'Notification preferences saved.', tone: 'neutral' });
    void service.save();
    http.expectOne('/api/notifications/app/settings').flush({}, { status: 500, statusText: 'Error' }); flushMicrotasks();
    expect(feedback[1]).toEqual({ message: 'Could not update notifications. Please try again.', tone: 'error' });
    expect(service.busy).toBeFalse();
  }));

  it('reports disable success through snackbar feedback', fakeAsync(() => {
    void service.disable(); flushMicrotasks();
    expect(feedback).toEqual([{ message: 'Notifications disabled on this device.', tone: 'neutral' }]);
  }));

  it('does not mask a save failure when browser notifications are blocked', fakeAsync(() => {
    (Object.getOwnPropertyDescriptor(service, 'blocked')!.get as jasmine.Spy).and.returnValue(true);
    void service.save();
    http.expectOne('/api/notifications/app/settings').flush({}, { status: 500, statusText: 'Error' });
    flushMicrotasks();
    expect(feedback).toEqual([{ message: 'Could not update notifications. Please try again.', tone: 'error' }]);
  }));

  it('does not open settings when a push notification is clicked', fakeAsync(() => {
    (push.notificationClicks as Subject<unknown>).next({}); flushMicrotasks();
    expect(service.open).toBeFalse(); http.expectNone('/api/notifications/app/settings');
  }));
});
