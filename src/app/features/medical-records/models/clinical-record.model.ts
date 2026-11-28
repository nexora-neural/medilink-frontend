export type ClinicalEntryKind = 'condition' | 'allergy' | 'diagnosis' | 'note';
export type ClinicalEntryStatus = 'active' | 'resolved' | 'entered_in_error' | 'superseded';
export type ClinicalEntrySource =
  'patient' | 'doctor' | 'pharmacist' | 'lab_staff' | 'approved_external_system' | 'admin';
export type AllergyStatus = 'unknown' | 'no-known-allergies' | 'allergies-recorded';

export interface ClinicalEntry {
  id: string;
  kind: ClinicalEntryKind;
  title: string;
  details: string | null;
  clinicalCode: string | null;
  recordedAt: string;
  source: ClinicalEntrySource;
  authorId: string;
  organizationId: string | null;
  status: ClinicalEntryStatus;
}

export interface ClinicalEntryDraft {
  kind: ClinicalEntryKind;
  title: string;
  details: string;
  recordedAt: string;
}

export const NO_KNOWN_ALLERGIES = 'No known allergies';

export const CLINICAL_ENTRY_LABELS: Record<ClinicalEntryKind, string> = {
  condition: 'Condition',
  allergy: 'Allergy',
  diagnosis: 'Diagnosis',
  note: 'Clinical note',
};

export const CLINICAL_STATUS_LABELS: Record<ClinicalEntryStatus, string> = {
  active: 'Active',
  resolved: 'Resolved',
  entered_in_error: 'Entered in error',
  superseded: 'Superseded',
};

export const CLINICAL_SOURCE_LABELS: Record<ClinicalEntrySource, string> = {
  patient: 'Patient-reported',
  doctor: 'Doctor-entered',
  pharmacist: 'Pharmacist-entered',
  lab_staff: 'Lab staff',
  approved_external_system: 'Approved external system',
  admin: 'Admin-entered',
};
