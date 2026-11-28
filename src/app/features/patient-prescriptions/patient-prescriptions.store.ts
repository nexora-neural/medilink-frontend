import { Injectable, InjectionToken } from '@angular/core';

export interface PrescriptionDraft {
  prescribedOn: string;
  prescriber: string;
  clinic: string;
  notes: string;
  medicines: { name: string; strength: string; instructions: string }[];
  evidence: File[];
}
export interface PatientPrescription extends PrescriptionDraft {
  id: string;
  source: 'Patient-added';
  verification: 'Not clinically verified';
}
export interface PrescriptionOcrDraft {
  prescribedOn: string;
  prescriber: string;
  clinic: string;
  notes: string;
  medicines: { name: string; strength: string; instructions: string }[];
}
export type PrescriptionOcrResult =
  { status: 'completed'; draft: PrescriptionOcrDraft } | { status: 'unreadable' };
export interface PatientPrescriptionOcrProcessor {
  extract(file: File): Promise<PrescriptionOcrResult>;
}
/** ML-175 replaces this preview with the authenticated OCR API adapter. */
@Injectable()
export class PatientPrescriptionOcrPreviewProcessor implements PatientPrescriptionOcrProcessor {
  async extract(_file: File): Promise<PrescriptionOcrResult> {
    // Keep the processing screen visible in the local UI preview.
    await new Promise((resolve) => setTimeout(resolve, 450));
    const date = new Date();
    return {
      status: 'completed',
      draft: {
        prescribedOn: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        prescriber: 'Example prescriber',
        clinic: 'Example clinic',
        notes:
          'Example OCR output for preview. Check and replace it using the original prescription.',
        medicines: [
          {
            name: 'Sample medicine',
            strength: 'As printed',
            instructions: 'Review against the original prescription',
          },
        ],
      },
    };
  }
}
export const PATIENT_PRESCRIPTION_OCR_PROCESSOR =
  new InjectionToken<PatientPrescriptionOcrProcessor>('PatientPrescriptionOcrProcessor');
/** ML-164 must supply an authenticated adapter and enforce rules on the server. */
export interface PatientPrescriptionsStore {
  list(): Promise<PatientPrescription[]>;
  add(draft: PrescriptionDraft): Promise<PatientPrescription>;
}
@Injectable()
export class PatientPrescriptionsPreviewStore implements PatientPrescriptionsStore {
  private records: PatientPrescription[] = [];
  async list(): Promise<PatientPrescription[]> {
    return [...this.records];
  }
  async add(draft: PrescriptionDraft): Promise<PatientPrescription> {
    const record: PatientPrescription = {
      ...draft,
      id: `preview-${this.records.length + 1}`,
      source: 'Patient-added',
      verification: 'Not clinically verified',
    };
    this.records = [record, ...this.records];
    return record;
  }
}
export const PATIENT_PRESCRIPTIONS_STORE = new InjectionToken<PatientPrescriptionsStore>(
  'PatientPrescriptionsStore',
);
