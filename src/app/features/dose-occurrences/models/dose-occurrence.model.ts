export type DoseOccurrenceStatus =
  'upcoming' | 'due' | 'unreported' | 'taken' | 'skipped' | 'cancelled';

export type DoseOccurrenceFilter = 'all' | 'upcoming' | 'due' | 'unreported';

export interface DoseOccurrence {
  id: string;
  scheduleId: string;
  medicineName: string;
  dosage: string;
  strength: string;
  instructions: string;
  scheduledFor: string;
  status: DoseOccurrenceStatus;
  snoozedUntil: string | null;
  createdAt: string;
  timezone: string;
}

export interface SnoozeResult {
  success: boolean;
  message: string;
  occurrence?: DoseOccurrence;
}
