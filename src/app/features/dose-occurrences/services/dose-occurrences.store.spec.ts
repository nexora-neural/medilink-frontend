import { beforeEach, describe, expect, it } from 'vitest';
import { DoseOccurrencesStore } from './dose-occurrences.store';

describe('DoseOccurrencesStore', () => {
  let store: DoseOccurrencesStore;

  beforeEach(() => {
    store = new DoseOccurrencesStore();
    store.loadDemoData();
  });

  it('should load demo dose occurrences', () => {
    expect(store.occurrences().length).toBeGreaterThan(0);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('');
  });

  it('should calculate upcoming, due and unreported counts', () => {
    expect(store.upcomingCount()).toBeGreaterThan(0);
    expect(store.dueCount()).toBeGreaterThan(0);
    expect(store.unreportedCount()).toBeGreaterThan(0);
  });

  it('should reject snoozing an occurrence that does not exist', () => {
    const result = store.snoozeOccurrence('unknown-id', 10);

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('should reject snoozing a taken occurrence', () => {
    const result = store.snoozeOccurrence('dose-004', 10);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Only due or unreported');
  });

  it('should reject an invalid snooze duration', () => {
    const result = store.snoozeOccurrence('dose-001', 5);

    expect(result.success).toBe(false);
    expect(result.message).toContain('valid snooze duration');
  });

  it('should update snoozedUntil without changing scheduledFor or status', () => {
    const original = store.occurrences().find((item) => item.id === 'dose-001');

    expect(original).toBeDefined();

    const originalScheduledFor = original!.scheduledFor;
    const originalStatus = original!.status;
    const now = new Date();

    const result = store.snoozeOccurrence('dose-001', 10, now);

    expect(result.success).toBe(true);
    expect(result.occurrence?.snoozedUntil).toBe(
      new Date(now.getTime() + 10 * 60 * 1000).toISOString(),
    );

    const updated = store.occurrences().find((item) => item.id === 'dose-001');

    expect(updated?.scheduledFor).toBe(originalScheduledFor);
    expect(updated?.status).toBe(originalStatus);
  });
});
