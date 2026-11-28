import { Injectable, computed, signal } from '@angular/core';
import {
  DoseOccurrence,
  DoseOccurrenceFilter,
  SnoozeResult,
} from '../models/dose-occurrence.model';

@Injectable({ providedIn: 'root' })
export class DoseOccurrencesStore {
  private readonly occurrencesState = signal<DoseOccurrence[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal('');

  readonly occurrences = this.occurrencesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly upcomingCount = computed(
    () => this.occurrences().filter((item) => item.status === 'upcoming').length,
  );

  readonly dueCount = computed(
    () => this.occurrences().filter((item) => item.status === 'due').length,
  );

  readonly unreportedCount = computed(
    () => this.occurrences().filter((item) => item.status === 'unreported').length,
  );

  loadDemoData(): void {
    this.loadingState.set(true);
    this.errorState.set('');

    try {
      const now = new Date();

      const hoursFromNow = (hours: number): string =>
        new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

      this.occurrencesState.set([
        {
          id: 'dose-001',
          scheduleId: 'schedule-001',
          medicineName: 'Vitamin D3',
          dosage: '1 tablet',
          strength: '1000 IU',
          instructions: 'Take after breakfast',
          scheduledFor: hoursFromNow(-0.25),
          status: 'due',
          snoozedUntil: null,
          createdAt: hoursFromNow(-24),
          timezone: 'Asia/Colombo',
        },
        {
          id: 'dose-002',
          scheduleId: 'schedule-002',
          medicineName: 'Metformin',
          dosage: '1 tablet',
          strength: '500 mg',
          instructions: 'Take with food',
          scheduledFor: hoursFromNow(-26),
          status: 'unreported',
          snoozedUntil: null,
          createdAt: hoursFromNow(-72),
          timezone: 'Asia/Colombo',
        },
        {
          id: 'dose-003',
          scheduleId: 'schedule-003',
          medicineName: 'Calcium',
          dosage: '1 tablet',
          strength: '600 mg',
          instructions: 'Take after dinner',
          scheduledFor: hoursFromNow(3),
          status: 'upcoming',
          snoozedUntil: null,
          createdAt: hoursFromNow(-48),
          timezone: 'Asia/Colombo',
        },
        {
          id: 'dose-004',
          scheduleId: 'schedule-001',
          medicineName: 'Vitamin D3',
          dosage: '1 tablet',
          strength: '1000 IU',
          instructions: 'Take after breakfast',
          scheduledFor: hoursFromNow(-24),
          status: 'taken',
          snoozedUntil: null,
          createdAt: hoursFromNow(-48),
          timezone: 'Asia/Colombo',
        },
        {
          id: 'dose-005',
          scheduleId: 'schedule-004',
          medicineName: 'Omega 3',
          dosage: '1 capsule',
          strength: '1000 mg',
          instructions: 'Take with lunch',
          scheduledFor: hoursFromNow(5),
          status: 'cancelled',
          snoozedUntil: null,
          createdAt: hoursFromNow(-24),
          timezone: 'Asia/Colombo',
        },
      ]);
    } catch {
      this.errorState.set('Unable to load dose occurrences. Please try again.');
    } finally {
      this.loadingState.set(false);
    }
  }

  getFilteredOccurrences(filter: DoseOccurrenceFilter): DoseOccurrence[] {
    if (filter === 'all') {
      return this.occurrences();
    }

    return this.occurrences().filter((item) => item.status === filter);
  }

  snoozeOccurrence(occurrenceId: string, minutes: number, now: Date = new Date()): SnoozeResult {
    const occurrence = this.occurrences().find((item) => item.id === occurrenceId);

    if (!occurrence) {
      return { success: false, message: 'Dose occurrence was not found.' };
    }

    if (occurrence.status !== 'due' && occurrence.status !== 'unreported') {
      return {
        success: false,
        message: 'Only due or unreported doses can be snoozed.',
      };
    }

    if (![10, 15, 30, 60].includes(minutes)) {
      return { success: false, message: 'Select a valid snooze duration.' };
    }

    const snoozedUntil = new Date(now.getTime() + minutes * 60 * 1000);
    const scheduledFor = new Date(occurrence.scheduledFor);

    if (
      Number.isNaN(scheduledFor.getTime()) ||
      Number.isNaN(snoozedUntil.getTime()) ||
      snoozedUntil <= now ||
      snoozedUntil.getTime() - now.getTime() > 24 * 60 * 60 * 1000
    ) {
      return { success: false, message: 'The snooze time must be within the next 24 hours.' };
    }

    const nextOccurrence = this.occurrences()
      .filter(
        (item) =>
          item.scheduleId === occurrence.scheduleId &&
          item.id !== occurrence.id &&
          new Date(item.scheduledFor) > scheduledFor &&
          item.status !== 'cancelled',
      )
      .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())[0];

    if (nextOccurrence && snoozedUntil >= new Date(nextOccurrence.scheduledFor)) {
      return {
        success: false,
        message: 'Snooze time cannot extend beyond the next scheduled dose.',
      };
    }

    const updatedOccurrence: DoseOccurrence = {
      ...occurrence,
      snoozedUntil: snoozedUntil.toISOString(),
    };

    this.occurrencesState.update((items) =>
      items.map((item) => (item.id === occurrenceId ? updatedOccurrence : item)),
    );

    return {
      success: true,
      message: `Reminder snoozed for ${minutes} minutes.`,
      occurrence: updatedOccurrence,
    };
  }

  clearError(): void {
    this.errorState.set('');
  }
}
