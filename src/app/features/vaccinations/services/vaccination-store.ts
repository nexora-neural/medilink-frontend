import { Injectable, computed, signal } from '@angular/core';

import {
  VaccinationDraft,
  VaccinationRecord,
  validateVaccinationCorrectionReason,
  validateVaccinationDraft,
} from '../models/vaccination.model';

interface SaveResult {
  refreshed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class VaccinationStore {
  private readonly activeState = signal<VaccinationRecord[]>([
    {
      id: 'vaccine-mock-001',
      patientUserId: 'mock-patient-001',
      patientReferenceId: 'P-1085',
      vaccineName: 'COVID-19',
      administeredOn: '2025-06-15',
      doseDetails: 'Booster dose',
      nextDoseOn: null,
      recordedBy: 'mock-doctor-001',
      source: 'doctor',
      organizationId: null,
      notes: 'Sample vaccination record',
      createdAt: '2025-06-15T09:30:00.000Z',
      supersedesId: null,
      correctionReason: null,
    },
    {
      id: 'vaccine-mock-002',
      patientUserId: 'mock-patient-001',
      patientReferenceId: 'P-1085',
      vaccineName: 'Influenza',
      administeredOn: '2025-10-10',
      doseDetails: 'Annual dose',
      nextDoseOn: '2026-10-10',
      recordedBy: 'mock-doctor-001',
      source: 'doctor',
      organizationId: null,
      notes: null,
      createdAt: '2025-10-10T08:00:00.000Z',
      supersedesId: null,
      correctionReason: null,
    },
  ]);

  private readonly historyState = signal<VaccinationRecord[]>([]);

  readonly current = this.activeState.asReadonly();
  readonly history = this.historyState.asReadonly();

  readonly totalCount = computed(() => this.current().length + this.history().length);

  async load(): Promise<void> {
    // Prototype store: records are held in local mock state.
    await Promise.resolve();
  }

  recordsForPatient(patientReferenceId: string): VaccinationRecord[] {
    return this.current().filter((record) => record.patientReferenceId === patientReferenceId);
  }

  historyForPatient(patientReferenceId: string): VaccinationRecord[] {
    return this.history().filter((record) => record.patientReferenceId === patientReferenceId);
  }

  async add(
    draft: VaccinationDraft,
    consultationId: string,
    patientReferenceId = 'P-1085',
    recordedBy = 'mock-doctor-001',
  ): Promise<SaveResult> {
    const error = validateVaccinationDraft(draft);

    if (error) {
      throw new Error(error);
    }

    if (!consultationId.trim()) {
      throw new Error('An active consultation is required to add a vaccination.');
    }

    if (!patientReferenceId.trim()) {
      throw new Error('Select a valid patient before adding a vaccination.');
    }

    const record: VaccinationRecord = {
      ...draft,
      id: crypto.randomUUID(),
      patientUserId: 'mock-patient-001',
      patientReferenceId,
      recordedBy,
      organizationId: null,
      createdAt: new Date().toISOString(),
      supersedesId: null,
      correctionReason: null,
    };

    this.activeState.update((records) => [record, ...records]);

    return { refreshed: true };
  }

  async correct(
    currentId: string,
    draft: VaccinationDraft,
    reason: string,
    consultationId: string,
    patientReferenceId = 'P-1085',
    recordedBy = 'mock-doctor-001',
  ): Promise<SaveResult> {
    const error = validateVaccinationDraft(draft);

    if (error) {
      throw new Error(error);
    }

    const reasonError = validateVaccinationCorrectionReason(reason);

    if (reasonError) {
      throw new Error(reasonError);
    }

    if (!consultationId.trim()) {
      throw new Error('An active consultation is required to correct a vaccination.');
    }

    const original = this.current().find(
      (record) => record.id === currentId && record.patientReferenceId === patientReferenceId,
    );

    if (!original) {
      throw new Error('Only an active vaccination record can be corrected.');
    }

    const correctedRecord: VaccinationRecord = {
      ...draft,
      id: crypto.randomUUID(),
      patientUserId: original.patientUserId,
      patientReferenceId: original.patientReferenceId,
      recordedBy,
      organizationId: original.organizationId,
      createdAt: new Date().toISOString(),
      supersedesId: original.id,
      correctionReason: reason.trim(),
    };

    this.activeState.update((records) => records.filter((record) => record.id !== currentId));

    this.historyState.update((records) => [original, ...records]);
    this.activeState.update((records) => [correctedRecord, ...records]);

    return { refreshed: true };
  }

  versionsFor(recordId: string): VaccinationRecord[] {
    const allRecords = [...this.current(), ...this.history()];
    const versions: VaccinationRecord[] = [];
    const visited = new Set<string>([recordId]);

    let nextId: string | null = recordId;

    while (nextId) {
      const nextRecord = allRecords.find(
        (record) => record.supersedesId === nextId && !visited.has(record.id),
      );

      if (!nextRecord) {
        break;
      }

      versions.push(nextRecord);
      visited.add(nextRecord.id);
      nextId = nextRecord.id;
    }

    return versions;
  }
}
