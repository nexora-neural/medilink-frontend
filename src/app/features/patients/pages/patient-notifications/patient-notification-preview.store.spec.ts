import { TestBed } from '@angular/core/testing';
import {
  PatientNotificationPreviewStore,
  SAMPLE_PATIENT_NOTIFICATIONS,
} from './patient-notification-preview.store';

describe('PatientNotificationPreviewStore', () => {
  let store: PatientNotificationPreviewStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(PatientNotificationPreviewStore);
  });

  it('provides clearly identified sample items and keeps read state scoped by account', async () => {
    const initial = await store.listFor('patient-a');
    expect(initial).toEqual(SAMPLE_PATIENT_NOTIFICATIONS);

    await store.markRead('patient-a', 'medication-reminder');

    const patientA = await store.listFor('patient-a');
    const patientB = await store.listFor('patient-b');
    expect(patientA.find((item) => item.id === 'medication-reminder')?.read).toBe(true);
    expect(patientB.find((item) => item.id === 'medication-reminder')?.read).toBe(false);
  });

  it('marks all sample notifications as read for one account only', async () => {
    await store.markAllRead('patient-a');

    expect((await store.listFor('patient-a')).every((item) => item.read)).toBe(true);
    expect((await store.listFor('patient-b')).filter((item) => !item.read)).toHaveLength(2);
  });

  it('keeps the header unread count in sync for each patient account', async () => {
    expect(store.unreadCountFor('patient-a')).toBe(2);

    await store.markRead('patient-a', 'medication-reminder');

    expect(store.unreadCountFor('patient-a')).toBe(1);
    expect(store.unreadCountFor('patient-b')).toBe(2);

    await store.markAllRead('patient-a');
    expect(store.unreadCountFor('patient-a')).toBe(0);
  });

  it('rejects an unknown notification id and an unidentified patient account', async () => {
    await expect(store.markRead('patient-a', 'other-account-notice')).rejects.toThrow(
      'Unknown sample notification',
    );
    await expect(store.listFor(null)).rejects.toThrow('patient account could not be identified');
  });

  it('rejects malformed local read state rather than silently changing it', async () => {
    localStorage.setItem('medilink.patient.notifications.preview.v1:patient-a', '{bad json');
    await expect(store.listFor('patient-a')).rejects.toThrow();
  });
});
