import { TestBed } from '@angular/core/testing';
import {
  DEFAULT_PATIENT_NOTIFICATION_PREFERENCES,
  PatientNotificationPreferencesPreviewStore,
} from './patient-notification-preferences-preview.store';

describe('PatientNotificationPreferencesPreviewStore', () => {
  let store: PatientNotificationPreferencesPreviewStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PatientNotificationPreferencesPreviewStore);
  });

  it('loads defaults and saves preferences per patient account in this browser', async () => {
    expect(await store.loadFor('patient-a')).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);

    const draft = { ...DEFAULT_PATIENT_NOTIFICATION_PREFERENCES, medication: false };
    await store.saveFor('patient-a', draft);

    expect(await store.loadFor('patient-a')).toEqual(draft);
    expect(await store.loadFor('patient-b')).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);
  });

  it('restores the sample defaults and validates stored preference values', async () => {
    await store.saveFor('patient-a', {
      medication: false,
      reports: false,
      account: false,
    });

    expect(await store.resetFor('patient-a')).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);
    expect(await store.loadFor('patient-a')).toEqual(DEFAULT_PATIENT_NOTIFICATION_PREFERENCES);

    localStorage.setItem(
      'medilink.patient.notification-preferences.preview.v1:patient-a',
      JSON.stringify({ medication: 'yes', reports: true, account: true }),
    );
    await expect(store.loadFor('patient-a')).rejects.toThrow('Saved preferences are invalid');
  });

  it('rejects incomplete or non-boolean preferences and unidentified accounts', async () => {
    await expect(
      store.saveFor('patient-a', { medication: true, reports: false } as never),
    ).rejects.toThrow('valid choices');
    await expect(store.loadFor(null)).rejects.toThrow('patient account could not be identified');
  });
});
