import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { Subject, firstValueFrom, take, timeout } from 'rxjs';

export interface NotificationPreferences { dca: boolean; briefing: boolean; returnReminder: boolean; }
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
  loadFailed = false;
  readonly feedback = new Subject<{ message: string; tone: 'neutral' | 'error' }>();
  preferences: NotificationPreferences = { dca: true, briefing: true, returnReminder: true };

  get supported(): boolean {
    return Boolean(this.push?.isEnabled && window.isSecureContext && 'Notification' in window && 'PushManager' in window);
  }
  get blocked(): boolean { return 'Notification' in window && Notification.permission === 'denied'; }

  async initialize(owner: string): Promise<void> {
    if (owner !== this.owner) { this.open = false; this.enabledOnDevice = false; }
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
    } catch { /* Dashboard availability does not depend on push setup. Opening settings retries configuration. */ }
  }

  async show(): Promise<void> {
    this.open = true; this.loadFailed = false; this.loading = true;
    try { await this.loadConfiguration(); }
    catch {
      this.loadFailed = true;
      this.feedback.next({ message: 'Could not load notification settings. Try again.', tone: 'error' });
    }
    finally { this.loading = false; }
  }

  private async loadConfiguration(): Promise<void> {
    const config = await firstValueFrom(this.http.get<Configuration>(`${this.base}/settings`));
    this.configured = config.configured; this.publicKey = config.publicKey; this.preferences = { ...config.preferences };
  }

  async save(): Promise<void> {
    await this.perform(async () => {
      await firstValueFrom(this.http.put(`${this.base}/settings`, this.preferences));
      this.feedback.next({ message: 'Notification preferences saved.', tone: 'neutral' });
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
      this.enabledOnDevice = true;
      this.feedback.next({ message: 'Notifications enabled on this device.', tone: 'neutral' });
    });
  }

  async disable(): Promise<void> {
    await this.perform(async () => {
      await this.detach();
      this.feedback.next({ message: 'Notifications disabled on this device.', tone: 'neutral' });
    });
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
    localStorage.removeItem(this.ownerKey); this.enabledOnDevice = false; this.open = false;
  }

  private subscription(): Promise<PushSubscription | null> {
    return this.push ? firstValueFrom(this.push.subscription.pipe(take(1), timeout(10000))) : Promise.resolve(null);
  }

  private async perform(action: () => Promise<void>): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try { await action(); }
    catch (error) {
      const message = error instanceof Error && !('status' in error)
        ? error.message : 'Could not update notifications. Please try again.';
      this.feedback.next({ message, tone: 'error' });
    } finally { this.busy = false; }
  }
}
