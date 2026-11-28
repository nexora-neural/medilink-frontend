import { Injectable, signal } from '@angular/core';

import {
  MedicineDoseOccurrence,
  MedicineDoseResponse,
  MedicineScheduleItem,
} from '../models/medicine-schedule.model';

function getDemoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values['year']}-${values['month']}-${values['day']}`;
}

const DEMO_DATE = getDemoDate();

const DEMO_SCHEDULES: MedicineScheduleItem[] = [
  {
    id: 'medicine-001',
    medicineName: 'Vitamin D3',
    strength: '1000 IU',
    dosage: '1 tablet',
    instructions: 'Take after breakfast.',
    prescribedBy: 'Dr. Sample',
    startDate: '2026-11-01',
    endDate: null,
    timezone: 'Asia/Colombo',
    status: 'active',
    doseTimes: [{ id: 'dose-001', time: '08:00', label: 'Morning' }],
  },
  {
    id: 'medicine-002',
    medicineName: 'Calcium',
    strength: '500 mg',
    dosage: '1 tablet',
    instructions: 'Take after dinner.',
    prescribedBy: 'Dr. Sample',
    startDate: '2026-11-01',
    endDate: null,
    timezone: 'Asia/Colombo',
    status: 'active',
    doseTimes: [{ id: 'dose-002', time: '20:00', label: 'Evening' }],
  },
];

const DEMO_OCCURRENCES: MedicineDoseOccurrence[] = [
  {
    id: 'occurrence-001',
    scheduleId: 'medicine-001',
    scheduledDate: DEMO_DATE,
    scheduledTime: '08:00',
    timezone: 'Asia/Colombo',
    status: 'unreported',
    reportedResponse: null,
    reportedAt: null,
    reminderSnoozedUntil: null,
  },
  {
    id: 'occurrence-002',
    scheduleId: 'medicine-002',
    scheduledDate: DEMO_DATE,
    scheduledTime: '20:00',
    timezone: 'Asia/Colombo',
    status: 'upcoming',
    reportedResponse: null,
    reportedAt: null,
    reminderSnoozedUntil: null,
  },
];

@Injectable()
export class MedicineScheduleStore {
  private readonly schedulesState = signal<MedicineScheduleItem[]>(
    DEMO_SCHEDULES.map((item) => ({
      ...item,
      doseTimes: item.doseTimes.map((dose) => ({ ...dose })),
    })),
  );

  private readonly occurrencesState = signal<MedicineDoseOccurrence[]>(
    DEMO_OCCURRENCES.map((item) => ({ ...item })),
  );

  private readonly confirmedSchedulesState = signal<string[]>([]);

  readonly schedules = this.schedulesState.asReadonly();

  readonly occurrences = this.occurrencesState.asReadonly();

  readonly confirmedSchedules = this.confirmedSchedulesState.asReadonly();

  confirmSchedule(id: string): boolean {
    const schedule = this.schedulesState().find((item) => item.id === id);

    if (!schedule || schedule.status !== 'active') {
      return false;
    }

    if (this.confirmedSchedulesState().includes(id)) {
      return true;
    }

    this.confirmedSchedulesState.update((items) => [...items, id]);

    return true;
  }

  isScheduleConfirmed(id: string): boolean {
    return this.confirmedSchedulesState().includes(id);
  }

  pause(id: string): void {
    this.updateStatus(id, 'paused');
  }

  resume(id: string): void {
    this.updateStatus(id, 'active');
  }

  replaceTime(medicineId: string, doseId: string, newTime: string): boolean {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(newTime)) {
      return false;
    }

    const medicine = this.schedulesState().find((item) => item.id === medicineId);

    if (
      !medicine ||
      medicine.status === 'paused' ||
      medicine.status === 'completed' ||
      medicine.status === 'cancelled'
    ) {
      return false;
    }

    const existingDose = medicine.doseTimes.find((dose) => dose.id === doseId);

    if (!existingDose) {
      return false;
    }

    if (existingDose.time === newTime) {
      return true;
    }

    const duplicate = medicine.doseTimes.some(
      (dose) => dose.id !== doseId && dose.time === newTime,
    );

    if (duplicate) {
      return false;
    }

    this.schedulesState.update((items) =>
      items.map((item) =>
        item.id === medicineId
          ? {
              ...item,
              doseTimes: item.doseTimes.map((dose) =>
                dose.id === doseId ? { ...dose, time: newTime } : dose,
              ),
            }
          : item,
      ),
    );

    this.confirmedSchedulesState.update((items) => items.filter((id) => id !== medicineId));

    return true;
  }

  snoozeOccurrence(occurrenceId: string, snoozedUntil: string): boolean {
    if (Number.isNaN(Date.parse(snoozedUntil))) {
      return false;
    }

    const occurrence = this.occurrencesState().find((item) => item.id === occurrenceId);

    if (
      !occurrence ||
      occurrence.status === 'taken' ||
      occurrence.status === 'skipped' ||
      occurrence.status === 'cancelled'
    ) {
      return false;
    }

    this.occurrencesState.update((items) =>
      items.map((item) =>
        item.id === occurrenceId ? { ...item, reminderSnoozedUntil: snoozedUntil } : item,
      ),
    );

    return true;
  }

  reportDose(occurrenceId: string, response: MedicineDoseResponse): boolean {
    const occurrence = this.occurrencesState().find((item) => item.id === occurrenceId);

    if (
      !occurrence ||
      occurrence.status === 'taken' ||
      occurrence.status === 'skipped' ||
      occurrence.status === 'cancelled'
    ) {
      return false;
    }

    this.occurrencesState.update((items) =>
      items.map((item) =>
        item.id === occurrenceId
          ? {
              ...item,
              status: response,
              reportedResponse: response,
              reportedAt: response === 'taken' ? new Date().toISOString() : null,
              reminderSnoozedUntil: null,
            }
          : item,
      ),
    );

    return true;
  }

  private updateStatus(id: string, status: 'active' | 'paused'): void {
    this.schedulesState.update((items) =>
      items.map((item) => {
        if (item.id !== id) return item;

        if (item.status === 'completed' || item.status === 'cancelled') {
          return item;
        }

        return { ...item, status };
      }),
    );
  }
}
