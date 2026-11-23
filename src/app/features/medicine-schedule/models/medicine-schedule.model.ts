export type MedicineScheduleStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export type MedicineDoseStatus =
  'upcoming' | 'due' | 'taken' | 'skipped' | 'unreported' | 'cancelled';

export type MedicineDoseResponse = 'taken' | 'skipped';

export interface MedicineDoseTime {
  id: string;
  time: string;
  label: string;
}

export interface MedicineScheduleItem {
  id: string;
  medicineName: string;
  strength: string;
  dosage: string;
  instructions: string;
  prescribedBy: string;
  startDate: string;
  endDate: string | null;
  timezone: string;
  status: MedicineScheduleStatus;
  doseTimes: MedicineDoseTime[];
}

export interface MedicineDoseOccurrence {
  id: string;
  scheduleId: string;
  scheduledDate: string;
  scheduledTime: string;
  timezone: string;
  status: MedicineDoseStatus;
  reportedResponse: MedicineDoseResponse | null;
  reportedAt: string | null;
  reminderSnoozedUntil: string | null;
}
