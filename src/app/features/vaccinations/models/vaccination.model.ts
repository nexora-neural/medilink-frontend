export type VaccinationSource =
  'patient' | 'doctor' | 'pharmacist' | 'lab_staff' | 'approved_external_system' | 'admin';

export interface VaccinationRecord {
  id: string;
  patientUserId: string;
  patientReferenceId: string;
  vaccineName: string;
  administeredOn: string;
  doseDetails: string | null;
  nextDoseOn: string | null;
  recordedBy: string;
  source: VaccinationSource;
  organizationId: string | null;
  notes: string | null;
  createdAt: string;
  supersedesId: string | null;
  correctionReason: string | null;
}

export type VaccinationDraft = Pick<
  VaccinationRecord,
  'vaccineName' | 'administeredOn' | 'doseDetails' | 'nextDoseOn' | 'source' | 'notes'
>;

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function validateVaccinationDraft(draft: VaccinationDraft): string | null {
  const vaccineName = draft.vaccineName.trim();

  if (!vaccineName) {
    return 'Enter the vaccine name.';
  }

  if (!isValidDate(draft.administeredOn)) {
    return 'Enter a valid vaccination date.';
  }

  const today = new Date().toISOString().slice(0, 10);

  if (draft.administeredOn > today) {
    return 'Vaccination date cannot be in the future.';
  }

  if (draft.nextDoseOn) {
    if (!isValidDate(draft.nextDoseOn)) {
      return 'Enter a valid next-dose date.';
    }

    if (draft.nextDoseOn < draft.administeredOn) {
      return 'Next-dose date cannot be before the vaccination date.';
    }
  }

  if (draft.source !== 'doctor') {
    return 'Only doctors can add vaccination records here.';
  }

  return null;
}

export function validateVaccinationCorrectionReason(reason: string): string | null {
  const trimmedReason = reason.trim();

  if (!trimmedReason || trimmedReason.length > 500) {
    return 'Enter a correction reason of 1-500 characters.';
  }

  return null;
}
