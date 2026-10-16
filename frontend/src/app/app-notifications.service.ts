import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom, take, timeout } from 'rxjs';

export interface NotificationPreferences { dca: boolean; briefing: boolean; returnReminder: boolean; }
export interface AppNotification { id: number; kind: string; title: string; body: string; createdAt: string; }
interface Configuration { configured: boolean; publicKey: string; preferences: NotificationPreferences; }

@Injectable({ providedIn: 'root' })
export class AppNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly push = inject(SwPush, { optional: true });
  private readonly base = '/api/notifications/app';
  private readonly ownerKey = 'open-fire.push.owner';
  private owner = '';
  private publicKey = '';
  open = false;
  configured = false;
  enabledOnDevice = false;
  busy = false;
  loading = false;
  error = '';
  status = '';
  messages: AppNotification[] = [];
  more = false;
  preferences: NotificationPreferences = { dca: false, briefing: false, returnReminder: false };

  constructor() {
    this.push?.notificationClicks.subscribe(() => { void this.show(); });
  }

  get supported(): boolean {
    return Boolean(this.push?.isEnabled && window.isSecureContext && 'Notification' in window && 'PushManager' in window);
  }
  get blocked(): boolean { return 'Notification' in window && Notification.permission === 'denied'; }

  async initialize(owner: string): Promise<void> {
    if (owner !== this.owner) { this.messages = []; this.open = false; this.enabledOnDevice = false; }
    this.owner = owner;
    try {
      await this.loadConfiguration();
      if (this.supported) {
        const subscription = await this.subscription();
        if (subscription && localStorage.getItem(this.ownerKey) !== owner) {
          // Never inherit another account's push permission/subscription on a shared browser.
          if (!await subscription.unsubscribe()) { throw new Error('Could not revoke the previous account subscription.'); }
          localStorage.removeItem(this.ownerKey);
        } else if (subscription && !this.blocked) {
          await firstValueFrom(this.http.post(`${this.base}/subscriptions`, subscription.toJSON()));
          this.enabledOnDevice = true;
        }
      }
      if (new URLSearchParams(location.search).has('notifications')) { await this.show(); }
    } catch { /* Dashboard availability does not depend on push setup. Errors remain visible in settings. */ }
  }

  async show(): Promise<void> {
    this.open = true; this.error = ''; this.loading = true;
    try { await Promise.all([this.loadConfiguration(), this.loadInbox()]); }
    catch { this.error = 'Could not load notifications. Try again.'; }
    finally { this.loading = false; }
  }

  private async loadConfiguration(): Promise<void> {
    const config = await firstValueFrom(this.http.get<Configuration>(`${this.base}/settings`));
    this.configured = config.configured; this.publicKey = config.publicKey; this.preferences = { ...config.preferences };
  }

  async loadInbox(append = false): Promise<void> {
    const before = append && this.messages.length ? `?before=${this.messages[this.messages.length - 1].id}` : '';
    const messages = await firstValueFrom(this.http.get<AppNotification[]>(`${this.base}${before}`));
    this.messages = append ? [...this.messages, ...messages] : messages;
    this.more = messages.length === 25;
  }

  async save(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.put(`${this.base}/settings`, this.preferences));
      this.status = 'Notification preferences saved.';
    });
  }

  async enable(): Promise<void> {
    await this.perform(async () => {
      if (!this.supported || !this.configured || !this.push) { throw new Error('Push notifications are unavailable on this device.'); }
      if (this.blocked) { throw new Error('Notifications are blocked in browser or app settings.'); }
      if (!Object.values(this.preferences).some(Boolean)) { throw new Error('Choose at least one notification category.'); }
      const subscription = await this.push.requestSubscription({ serverPublicKey: this.publicKey });
      try {
        await firstValueFrom(this.http.put(`${this.base}/settings`, this.preferences));
        await firstValueFrom(this.http.post(`${this.base}/subscriptions`, subscription.toJSON()));
      } catch (error) { await subscription.unsubscribe(); throw error; }
      localStorage.setItem(this.ownerKey, this.owner);
      this.enabledOnDevice = true; this.status = 'Notifications enabled on this device.';
    });
  }

  async disable(): Promise<void> {
    await this.perform(async () => { await this.detach(); this.status = 'Notifications disabled on this device.'; });
  }

  async detach(): Promise<void> {
    if (this.supported) {
      const subscription = await this.subscription();
      if (subscription) {
        // Revoke locally before navigating away, even if the API is temporarily offline.
        const revoked = await subscription.unsubscribe();
        if (!revoked) { throw new Error('Could not disable notifications. Check your browser settings before signing out.'); }
        try { await firstValueFrom(this.http.delete(`${this.base}/subscriptions`, { body: { endpoint: subscription.endpoint } }).pipe(timeout(5000))); }
        catch { /* Revoked endpoints are pruned by the push worker. */ }
      }
    }
    localStorage.removeItem(this.ownerKey); this.enabledOnDevice = false; this.open = false; this.messages = [];
  }

  async test(): Promise<void> {
    await this.perform(async () => {
      const subscription = await this.subscription();
      if (!subscription || !this.enabledOnDevice) { throw new Error('Enable notifications on this device first.'); }
      await firstValueFrom(this.http.post(`${this.base}/test`, { endpoint: subscription.endpoint }));
      this.status = 'Test notification queued.'; await this.loadInbox();
    });
  }

  private subscription(): Promise<PushSubscription | null> {
    return this.push ? firstValueFrom(this.push.subscription.pipe(take(1), timeout(10000))) : Promise.resolve(null);
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.error = ''; this.status = '';
    try { await action(); }
    catch (error) {
      this.error = this.blocked ? 'Notifications are blocked in browser or app settings.'
        : error instanceof Error && !('status' in error) ? error.message : 'Could not update notifications. Please try again.';
    } finally { this.busy = false; }
  }
}
