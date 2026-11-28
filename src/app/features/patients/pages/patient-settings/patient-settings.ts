import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveRoleService } from '../../../../core/context/active-role.service';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import {
  DEFAULT_PATIENT_NOTIFICATION_PREFERENCES,
  PatientNotificationPreferences,
  PatientNotificationPreferencesPreviewStore,
} from './patient-notification-preferences-preview.store';

type PreferencesPageState = 'loading' | 'ready' | 'error';
type PreferenceKey = keyof PatientNotificationPreferences;

@Component({
  selector: 'app-patient-settings',
  standalone: true,
  imports: [RouterLink, UiState],
  templateUrl: './patient-settings.html',
  styleUrl: './patient-settings.scss',
})
export class PatientSettings implements OnInit {
  private readonly roles = inject(ActiveRoleService);
  private readonly store = inject(PatientNotificationPreferencesPreviewStore);

  readonly state = signal<PreferencesPageState>('loading');
  readonly saved = signal<PatientNotificationPreferences>({
    ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES,
  });
  readonly draft = signal<PatientNotificationPreferences>({
    ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES,
  });
  readonly dirty = computed(() => {
    const saved = this.saved();
    const draft = this.draft();
    return (
      saved.medication !== draft.medication ||
      saved.reports !== draft.reports ||
      saved.account !== draft.account
    );
  });
  readonly saving = signal(false);
  readonly error = signal('');
  readonly validationError = signal('');
  readonly message = signal('');

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.state.set('loading');
    this.error.set('');
    this.validationError.set('');
    this.message.set('');

    try {
      const preferences = await this.store.loadFor(this.roles.activeAccountId());
      this.saved.set({ ...preferences });
      this.draft.set({ ...preferences });
      this.state.set('ready');
    } catch {
      this.error.set('Preferences could not be loaded from this browser. Please retry.');
      this.state.set('error');
    }
  }

  setPreference(key: PreferenceKey, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.draft.update((preferences) => ({ ...preferences, [key]: checked }));
    this.error.set('');
    this.validationError.set('');
    this.message.set('');
  }

  discard(): void {
    this.draft.set({ ...this.saved() });
    this.error.set('');
    this.validationError.set('');
    this.message.set('Unsaved preference changes were discarded.');
  }

  async save(): Promise<void> {
    if (this.saving() || this.state() !== 'ready' || !this.dirty()) return;

    const preferences = this.draft();
    if (!this.isPreferences(preferences)) {
      this.validationError.set('Choose a valid on or off value for each preference.');
      this.message.set('');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.validationError.set('');
    this.message.set('');
    try {
      await this.store.saveFor(this.roles.activeAccountId(), preferences);
      this.saved.set({ ...preferences });
      this.message.set('Preview preferences saved in this browser for this account.');
    } catch {
      this.error.set('Preferences could not be saved. Check browser storage and retry.');
    } finally {
      this.saving.set(false);
    }
  }

  async restoreDefaults(): Promise<void> {
    this.error.set('');
    this.message.set('');
    try {
      const preferences = await this.store.resetFor(this.roles.activeAccountId());
      this.saved.set({ ...preferences });
      this.draft.set({ ...preferences });
      this.state.set('ready');
      this.message.set('Sample preferences were restored for this browser and account.');
    } catch {
      this.error.set('Saved preferences could not be cleared. Check browser storage and retry.');
    }
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
}
