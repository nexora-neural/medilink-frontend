import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type PatientNotificationCategory = 'medication' | 'reports' | 'account';

export interface PatientNotification {
  id: string;
  category: PatientNotificationCategory;
  icon: string;
  title: string;
  body: string;
  time: string;
  path: string;
  read: boolean;
}

export const SAMPLE_PATIENT_NOTIFICATIONS: readonly PatientNotification[] = [
  {
    id: 'medication-reminder',
    category: 'medication',
    icon: 'medication',
    title: 'Medication reminder',
    body: 'Review your medication schedule for today.',
    time: 'Today',
    path: '/workspace/patient/medications',
    read: false,
  },
  {
    id: 'report-available',
    category: 'reports',
    icon: 'description',
    title: 'Report available',
    body: 'A health report is available to view.',
    time: 'Earlier',
    path: '/workspace/patient/reports',
    read: false,
  },
  {
    id: 'doctor-access',
    category: 'account',
    icon: 'shield_person',
    title: 'Doctor access',
    body: 'Review your shared access and permissions.',
    time: 'Earlier',
    path: '/workspace/patient/access',
    read: true,
  },
];

@Injectable({ providedIn: 'root' })
export class PatientNotificationPreviewStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly unreadByAccount = signal<Record<string, number>>({});

  async listFor(accountId: string | null): Promise<PatientNotification[]> {
    const readIds = this.readIdsFor(accountId);
    const notifications = SAMPLE_PATIENT_NOTIFICATIONS.map((notification) => ({
      ...notification,
      read: readIds.has(notification.id),
    }));
    this.setUnreadCount(
      accountId,
      notifications.filter((notification) => !notification.read).length,
    );
    return notifications;
  }

  unreadCountFor(accountId: string | null): number {
    const normalizedAccountId = accountId?.trim();
    if (!normalizedAccountId) return 0;

    const cachedCount = this.unreadByAccount()[normalizedAccountId];
    if (cachedCount !== undefined) return cachedCount;

    try {
      const readIds = this.readIdsFor(normalizedAccountId);
      return SAMPLE_PATIENT_NOTIFICATIONS.filter((notification) => !readIds.has(notification.id))
        .length;
    } catch {
      return 0;
    }
  }

  async markRead(accountId: string | null, notificationId: string): Promise<void> {
    const validId = SAMPLE_PATIENT_NOTIFICATIONS.some((item) => item.id === notificationId);
    if (!validId) throw new Error('Unknown sample notification.');

    const readIds = this.readIdsFor(accountId);
    readIds.add(notificationId);
    this.writeReadIds(accountId, readIds);
    this.setUnreadCount(
      accountId,
      SAMPLE_PATIENT_NOTIFICATIONS.filter((notification) => !readIds.has(notification.id)).length,
    );
  }

  async markAllRead(accountId: string | null): Promise<void> {
    this.writeReadIds(
      accountId,
      new Set(SAMPLE_PATIENT_NOTIFICATIONS.map((notification) => notification.id)),
    );
    this.setUnreadCount(accountId, 0);
  }

  private readIdsFor(accountId: string | null): Set<string> {
    const key = this.storageKey(accountId);
    const defaults = new Set(
      SAMPLE_PATIENT_NOTIFICATIONS.filter((notification) => notification.read).map(
        (notification) => notification.id,
      ),
    );

    if (!isPlatformBrowser(this.platformId)) return defaults;

    const stored = localStorage.getItem(key);
    if (stored === null) return defaults;

    const parsed: unknown = JSON.parse(stored);
    if (
      !Array.isArray(parsed) ||
      parsed.some(
        (id) =>
          typeof id !== 'string' ||
          !SAMPLE_PATIENT_NOTIFICATIONS.some((notification) => notification.id === id),
      )
    ) {
      throw new Error('Saved notification state is invalid.');
    }

    return new Set([...defaults, ...parsed]);
  }

  private writeReadIds(accountId: string | null, readIds: Set<string>): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem(this.storageKey(accountId), JSON.stringify([...readIds]));
  }

  private storageKey(accountId: string | null): string {
    if (!accountId?.trim()) throw new Error('The patient account could not be identified.');
    return `medilink.patient.notifications.preview.v1:${encodeURIComponent(accountId)}`;
  }

  private setUnreadCount(accountId: string | null, count: number): void {
    if (!accountId?.trim()) return;
    this.unreadByAccount.update((counts) => ({ ...counts, [accountId]: count }));
  }
}
