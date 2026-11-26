import { beforeEach, describe, expect, it } from 'vitest';
import { MedicineScheduleStore } from './medicine-schedule.store';

describe('MedicineScheduleStore', () => {
  let store: MedicineScheduleStore;

  beforeEach(() => {
    store = new MedicineScheduleStore();
  });

  it('loads the sample medicine schedules', () => {
    expect(store.schedules()).toHaveLength(2);
    expect(store.schedules()[0]?.medicineName).toBe('Vitamin D3');
    expect(store.schedules()[1]?.medicineName).toBe('Calcium');
  });

  it('confirms an active schedule', () => {
    expect(store.confirmSchedule('medicine-001')).toBe(true);
    expect(store.isScheduleConfirmed('medicine-001')).toBe(true);
  });

  it('does not confirm an unknown schedule', () => {
    expect(store.confirmSchedule('unknown')).toBe(false);
  });

  it('does not confirm a paused schedule', () => {
    store.pause('medicine-001');

    expect(store.confirmSchedule('medicine-001')).toBe(false);
    expect(store.isScheduleConfirmed('medicine-001')).toBe(false);
  });

  it('does not duplicate an existing confirmation', () => {
    store.confirmSchedule('medicine-001');
    store.confirmSchedule('medicine-001');

    expect(store.confirmedSchedules()).toEqual(['medicine-001']);
  });

  it('pauses and resumes a schedule', () => {
    store.pause('medicine-001');
    expect(store.schedules()[0]?.status).toBe('paused');

    store.resume('medicine-001');
    expect(store.schedules()[0]?.status).toBe('active');
  });

  it('replaces a dose time with a valid time', () => {
    expect(store.replaceTime('medicine-001', 'dose-001', '09:30')).toBe(true);
    expect(store.schedules()[0]?.doseTimes[0]?.time).toBe('09:30');
  });

  it('requires confirmation again after changing a dose time', () => {
    store.confirmSchedule('medicine-001');

    expect(store.isScheduleConfirmed('medicine-001')).toBe(true);

    store.replaceTime('medicine-001', 'dose-001', '09:30');

    expect(store.isScheduleConfirmed('medicine-001')).toBe(false);
  });

  it('keeps confirmation when the dose time remains unchanged', () => {
    store.confirmSchedule('medicine-001');

    expect(store.replaceTime('medicine-001', 'dose-001', '08:00')).toBe(true);
    expect(store.isScheduleConfirmed('medicine-001')).toBe(true);
  });

  it('rejects an invalid dose time', () => {
    expect(store.replaceTime('medicine-001', 'dose-001', '25:90')).toBe(false);
    expect(store.schedules()[0]?.doseTimes[0]?.time).toBe('08:00');
  });

  it('allows the same dose time across different medicines', () => {
    expect(store.replaceTime('medicine-001', 'dose-001', '20:00')).toBe(true);
    expect(store.schedules()[0]?.doseTimes[0]?.time).toBe('20:00');
  });

  it('rejects replacing a dose time for an unknown medicine', () => {
    expect(store.replaceTime('unknown', 'dose-001', '09:00')).toBe(false);
  });

  it('rejects replacing a time for a paused schedule', () => {
    store.pause('medicine-001');

    expect(store.replaceTime('medicine-001', 'dose-001', '09:00')).toBe(false);
  });

  it('reports a dose as taken', () => {
    expect(store.reportDose('occurrence-001', 'taken')).toBe(true);
    expect(store.occurrences()[0]?.status).toBe('taken');
    expect(store.occurrences()[0]?.reportedResponse).toBe('taken');
    expect(store.occurrences()[0]?.reportedAt).not.toBeNull();
  });

  it('reports a dose as skipped', () => {
    expect(store.reportDose('occurrence-001', 'skipped')).toBe(true);
    expect(store.occurrences()[0]?.status).toBe('skipped');
    expect(store.occurrences()[0]?.reportedResponse).toBe('skipped');
  });

  it('rejects reporting an unknown occurrence', () => {
    expect(store.reportDose('unknown', 'taken')).toBe(false);
  });

  it('does not allow reporting an already completed dose again', () => {
    store.reportDose('occurrence-001', 'taken');

    expect(store.reportDose('occurrence-001', 'skipped')).toBe(false);
    expect(store.occurrences()[0]?.status).toBe('taken');
  });

  it('snoozes an upcoming reminder', () => {
    const snoozedUntil = '2026-11-26T09:00:00.000Z';

    expect(store.snoozeOccurrence('occurrence-002', snoozedUntil)).toBe(true);
    expect(store.occurrences()[1]?.reminderSnoozedUntil).toBe(snoozedUntil);
  });

  it('rejects an invalid snooze date', () => {
    expect(store.snoozeOccurrence('occurrence-002', 'invalid-date')).toBe(false);
  });
});
