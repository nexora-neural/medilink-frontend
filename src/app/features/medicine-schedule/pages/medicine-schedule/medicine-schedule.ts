import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { UiState } from '../../../../shared/components/ui-state/ui-state';
import { MedicineDoseResponse } from '../../models/medicine-schedule.model';
import { MedicineScheduleStore } from '../../services/medicine-schedule.store';

type PageState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-medicine-schedule',
  standalone: true,
  imports: [DatePipe, UiState],
  providers: [MedicineScheduleStore],
  templateUrl: './medicine-schedule.html',
  styleUrl: './medicine-schedule.scss',
})
export class MedicineSchedule {
  private readonly store = inject(MedicineScheduleStore);

  readonly schedules = this.store.schedules;
  readonly occurrences = this.store.occurrences;
  readonly confirmedSchedules = this.store.confirmedSchedules;

  readonly pageState = signal<PageState>('ready');
  readonly selectedDate = signal(this.getLocalDate());
  readonly timezone = 'Asia/Colombo';
  readonly message = signal('');
  readonly error = signal('');

  readonly activeCount = computed(
    () => this.schedules().filter((item) => item.status === 'active').length,
  );

  readonly pausedCount = computed(
    () => this.schedules().filter((item) => item.status === 'paused').length,
  );

  readonly totalDoses = computed(() =>
    this.schedules().reduce((total, item) => total + item.doseTimes.length, 0),
  );

  readonly selectedDateOccurrences = computed(() =>
    this.occurrences().filter((item) => item.scheduledDate === this.selectedDate()),
  );

  readonly takenCount = computed(
    () => this.selectedDateOccurrences().filter((item) => item.status === 'taken').length,
  );

  readonly skippedCount = computed(
    () => this.selectedDateOccurrences().filter((item) => item.status === 'skipped').length,
  );

  confirmSchedule(id: string): void {
    const confirmed = this.store.confirmSchedule(id);

    if (!confirmed) {
      this.error.set('Unable to confirm this schedule.');
      this.message.set('');
      return;
    }

    this.message.set('Schedule confirmation recorded in this demo.');
    this.error.set('');
  }

  isScheduleConfirmed(id: string): boolean {
    return this.store.isScheduleConfirmed(id);
  }

  pause(id: string): void {
    this.store.pause(id);
    this.message.set('Medicine schedule paused in this demo.');
    this.error.set('');
  }

  resume(id: string): void {
    this.store.resume(id);
    this.message.set('Medicine schedule resumed in this demo.');
    this.error.set('');
  }

  replaceTime(medicineId: string, doseId: string, newTime: string): void {
    if (!newTime) {
      this.error.set('Please select a valid dose time.');
      this.message.set('');
      return;
    }

    const updated = this.store.replaceTime(medicineId, doseId, newTime);

    if (!updated) {
      this.error.set('Unable to replace the dose time. Check the selected time and try again.');
      this.message.set('');
      return;
    }

    this.message.set('Dose time updated in this demo.');
    this.error.set('');
  }

  snoozeOccurrence(occurrenceId: string): void {
    const snoozedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const updated = this.store.snoozeOccurrence(occurrenceId, snoozedUntil);

    if (!updated) {
      this.error.set('Unable to snooze this reminder.');
      this.message.set('');
      return;
    }

    this.message.set('Reminder snoozed for 10 minutes in this demo.');
    this.error.set('');
  }

  reportDose(occurrenceId: string, response: MedicineDoseResponse): void {
    const updated = this.store.reportDose(occurrenceId, response);

    if (!updated) {
      this.error.set('Unable to update this dose report.');
      this.message.set('');
      return;
    }

    this.message.set(
      response === 'taken'
        ? 'Dose reported as taken. This is a patient-reported entry.'
        : 'Dose reported as skipped.',
    );
    this.error.set('');
  }

  changeDate(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.value) return;

    this.selectedDate.set(input.value);
    this.message.set('');
    this.error.set('');
  }

  retry(): void {
    this.pageState.set(this.schedules().length > 0 ? 'ready' : 'empty');
    this.error.set('');
  }

  private getLocalDate(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return `${values['year']}-${values['month']}-${values['day']}`;
  }
}
