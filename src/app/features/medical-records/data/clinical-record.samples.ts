import { ClinicalEntry } from '../models/clinical-record.model';

export const SAMPLE_PATIENT_ID = 'sample-patient';
export const SAMPLE_DOCTOR_ID = 'sample-doctor-current';

export function createSampleEntries(): ClinicalEntry[] {
  return [
    {
      id: 'sample-note-1',
      kind: 'note',
      title: 'Sample follow-up note',
      details: 'Fictional consultation note for demonstrating the records screen.',
      recordedAt: '2026-11-12T09:00:00Z',
      source: 'doctor',
      authorId: SAMPLE_DOCTOR_ID,
      authorName: 'Dr. Sample Silva',
      organization: 'Example Care Clinic',
      status: 'active',
    },
    {
      id: 'sample-diagnosis-1',
      kind: 'diagnosis',
      title: 'Sample diagnosis',
      details: 'Fictional diagnosis entered by a different doctor.',
      recordedAt: '2026-11-10T08:30:00Z',
      source: 'doctor',
      authorId: 'sample-doctor-other',
      authorName: 'Dr. Example Perera',
      organization: 'Example Community Clinic',
      status: 'resolved',
    },
    {
      id: 'sample-allergy-1',
      kind: 'allergy',
      title: 'Sample medicine allergy',
      details: 'Patient-reported example; not clinically verified.',
      recordedAt: '2026-11-08T10:00:00Z',
      source: 'patient',
      authorId: SAMPLE_PATIENT_ID,
      authorName: 'Sample Patient',
      organization: null,
      status: 'active',
    },
    {
      id: 'sample-condition-1',
      kind: 'condition',
      title: 'Sample long-term condition',
      details: 'Fictional patient-reported condition for preview only.',
      recordedAt: '2026-11-05T07:00:00Z',
      source: 'patient',
      authorId: SAMPLE_PATIENT_ID,
      authorName: 'Sample Patient',
      organization: null,
      status: 'active',
    },
  ];
}
