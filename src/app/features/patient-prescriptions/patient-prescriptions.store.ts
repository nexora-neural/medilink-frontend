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
