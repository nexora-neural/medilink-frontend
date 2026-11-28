import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MedicineScheduleStore } from './medicine-schedule.store';

describe('MedicineScheduleStore replaceTime', () => {
  let store: MedicineScheduleStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T10:00:00+05:30'));
    store = new MedicineScheduleStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates matching future unanswered occurrences when a dose time changes', () => {
    expect(store.snoozeOccurrence('occurrence-002', '2026-11-22T10:30:00+05:30')).toBe(true);

    const result = store.replaceTime('medicine-002', 'dose-002', '21:00');

    expect(result).toBe(true);

    expect(store.schedules().find((item) => item.id === 'medicine-002')?.doseTimes[0].time).toBe(
      '21:00',
    );

    const occurrence = store.occurrences().find((item) => item.id === 'occurrence-002');

    expect(occurrence?.scheduledTime).toBe('21:00');
    expect(occurrence?.status).toBe('upcoming');
    expect(occurrence?.reminderSnoozedUntil).toBeNull();
  });

  it('preserves reported dose occurrences when the schedule time changes', () => {
    expect(store.reportDose('occurrence-002', 'taken')).toBe(true);

    const reportedOccurrence = store.occurrences().find((item) => item.id === 'occurrence-002');

    const reportedAt = reportedOccurrence?.reportedAt;

    vi.setSystemTime(new Date('2026-11-24T10:00:00+05:30'));

    expect(store.replaceTime('medicine-002', 'dose-002', '21:00')).toBe(true);

    const occurrence = store.occurrences().find((item) => item.id === 'occurrence-002');

    expect(occurrence?.scheduledTime).toBe('20:00');
    expect(occurrence?.status).toBe('taken');
    expect(occurrence?.reportedResponse).toBe('taken');
    expect(occurrence?.reportedAt).toBe(reportedAt);
  });

  it('does not change past unanswered occurrences', () => {
    vi.setSystemTime(new Date('2026-11-24T10:00:00+05:30'));

    expect(store.replaceTime('medicine-002', 'dose-002', '21:00')).toBe(true);

    const occurrence = store.occurrences().find((item) => item.id === 'occurrence-002');

    expect(occurrence?.scheduledTime).toBe('20:00');
    expect(occurrence?.status).toBe('upcoming');
  });
});
