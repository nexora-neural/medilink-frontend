export type ClinicalEntryKind = 'condition' | 'allergy' | 'diagnosis' | 'note';

export type ClinicalEntryStatus = 'active' | 'resolved' | 'entered-in-error';

export type AllergyStatus = 'unknown' | 'no-known-allergies' | 'allergies-recorded';

export type RecordPageState = 'ready' | 'loading' | 'empty' | 'error' | 'denied';

export interface ClinicalEntry {
  id: string;
  kind: ClinicalEntryKind;
  title: string;
  details: string;
  recordedAt: string;
  source: 'patient' | 'doctor';
  authorId: string;
  authorName: string;
  organization: string | null;
  status: ClinicalEntryStatus;
}

export interface ClinicalEntryDraft {
  kind: ClinicalEntryKind;
  title: string;
  details: string;
  recordedAt: string;
}

export const CLINICAL_ENTRY_LABELS: Record<ClinicalEntryKind, string> = {
  condition: 'Condition',
  allergy: 'Allergy',
  diagnosis: 'Diagnosis',
  note: 'Clinical note',
};

export const CLINICAL_STATUS_LABELS: Record<ClinicalEntryStatus, string> = {
  active: 'Active',
  resolved: 'Resolved',
  'entered-in-error': 'Entered in error',
};
