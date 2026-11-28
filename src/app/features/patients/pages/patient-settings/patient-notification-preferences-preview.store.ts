import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

export interface PatientNotificationPreferences {
  medication: boolean;
  reports: boolean;
  account: boolean;
}

export const DEFAULT_PATIENT_NOTIFICATION_PREFERENCES: PatientNotificationPreferences = {
  medication: true,
  reports: true,
  account: true,
};

@Injectable({ providedIn: 'root' })
export class PatientNotificationPreferencesPreviewStore {
  private readonly platformId = inject(PLATFORM_ID);

  async loadFor(accountId: string | null): Promise<PatientNotificationPreferences> {
    const key = this.storageKey(accountId);
    if (!isPlatformBrowser(this.platformId)) {
      return { ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES };
    }

    const stored = localStorage.getItem(key);
    if (stored === null) return { ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES };

    const parsed: unknown = JSON.parse(stored);
    if (!this.isPreferences(parsed)) throw new Error('Saved preferences are invalid.');
    return { ...parsed };
  }

  async saveFor(
    accountId: string | null,
    preferences: PatientNotificationPreferences,
  ): Promise<void> {
    if (!this.isPreferences(preferences)) throw new Error('Preferences must be valid choices.');
    if (!isPlatformBrowser(this.platformId)) return;

    localStorage.setItem(this.storageKey(accountId), JSON.stringify(preferences));
  }

  async resetFor(accountId: string | null): Promise<PatientNotificationPreferences> {
    if (isPlatformBrowser(this.platformId)) localStorage.removeItem(this.storageKey(accountId));
    return { ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES };
  }

  private isPreferences(value: unknown): value is PatientNotificationPreferences {
    if (typeof value !== 'object' || value === null) return false;
    const preferences = value as Record<string, unknown>;
    return (
      typeof preferences['medication'] === 'boolean' &&
      typeof preferences['reports'] === 'boolean' &&
      typeof preferences['account'] === 'boolean'
    );
  }

  private storageKey(accountId: string | null): string {
    if (!accountId?.trim()) throw new Error('The patient account could not be identified.');
    return `medilink.patient.notification-preferences.preview.v1:${encodeURIComponent(accountId)}`;
  }
}
