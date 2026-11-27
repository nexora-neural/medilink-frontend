import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  PatientNotification,
  PatientNotificationPreviewStore,
} from './patient-notification-preview.store';

type NotificationPageState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-patient-notifications',
  standalone: true,
  imports: [RouterLink, UiState],
  templateUrl: './patient-notifications.html',
  styleUrl: './patient-notifications.scss',
})
export class PatientNotifications implements OnInit {
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PatientNotificationPreviewStore);

  readonly state = signal<NotificationPageState>('loading');
  readonly notifications = signal<PatientNotification[]>([]);
  readonly unreadCount = computed(
    () => this.notifications().filter((notification) => !notification.read).length,
  );
  readonly refreshing = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.refreshing()) return;

    const initialLoad = this.state() === 'loading' || this.state() === 'error';
    const accountId = this.roles.activeAccountId();
    this.refreshing.set(true);
    this.error.set('');
    this.message.set('');
    if (initialLoad) this.state.set('loading');

    try {
      const result = await this.store.listFor(accountId);
      if (accountId !== this.roles.activeAccountId()) return;
      this.notifications.set(result);
      this.state.set('ready');
      this.message.set('Notifications refreshed.');
    } catch {
      this.error.set('Notifications could not be loaded. Please try again.');
      if (initialLoad) this.state.set('error');
    } finally {
      this.refreshing.set(false);
    }
  }

  async markRead(notification: PatientNotification): Promise<void> {
    if (notification.read) return;

    this.error.set('');
    try {
      await this.store.markRead(this.roles.activeAccountId(), notification.id);
      this.notifications.update((items) =>
        items.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
      );
      this.message.set(`${notification.title} marked as read.`);
    } catch {
      this.error.set('This notification could not be marked as read. Please try again.');
    }
  }

  async markAllRead(): Promise<void> {
    if (this.unreadCount() === 0) return;

    this.error.set('');
    try {
      await this.store.markAllRead(this.roles.activeAccountId());
      this.notifications.update((items) => items.map((item) => ({ ...item, read: true })));
      this.message.set('All notifications marked as read.');
    } catch {
      this.error.set('Notifications could not be updated. Please try again.');
    }
  }
}
