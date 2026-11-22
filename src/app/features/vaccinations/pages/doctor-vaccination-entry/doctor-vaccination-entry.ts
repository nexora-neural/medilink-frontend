import { Component, computed, inject, signal } from '@angular/core';

import { VaccinationDraft, VaccinationRecord } from '../../models/vaccination.model';
import { VaccinationStore } from '../../services/vaccination-store';

type ConsultationStatus = 'waiting' | 'in-consultation' | 'completed';
type FormMode = 'baseline' | 'correction';

interface ConsultationPatient {
  id: string;
  name: string;
  referenceNumber: string;
  readAccess: 'active' | 'expired' | 'revoked';
  consultationPermission: 'granted' | 'not-granted' | 'expired';
  consultationId: string;
  status: ConsultationStatus;
}

@Component({
  selector: 'app-doctor-vaccination-entry',
  standalone: true,
  templateUrl: './doctor-vaccination-entry.html',
  styleUrl: './doctor-vaccination-entry.scss',
})
export class DoctorVaccinationEntry {
  private readonly store = inject(VaccinationStore);

  readonly patients = signal<ConsultationPatient[]>([
    {
      id: 'P-1085',
      name: 'Kasun Fernando',
      referenceNumber: 'ML-P-1085',
      readAccess: 'active',
      consultationPermission: 'granted',
      consultationId: 'consultation-1085',
      status: 'in-consultation',
    },
    {
      id: 'P-1042',
      name: 'Nadeesha Perera',
      referenceNumber: 'ML-P-1042',
      readAccess: 'active',
      consultationPermission: 'granted',
      consultationId: 'consultation-1042',
      status: 'waiting',
    },
    {
      id: 'P-1120',
      name: 'Amaya Silva',
      referenceNumber: 'ML-P-1120',
      readAccess: 'active',
      consultationPermission: 'not-granted',
      consultationId: '',
      status: 'completed',
    },
  ]);

  readonly selectedPatientId = signal('P-1085');

  readonly selectedPatient = computed(
    () => this.patients().find((patient) => patient.id === this.selectedPatientId()) ?? null,
  );

  readonly canRecord = computed(() => {
    const patient = this.selectedPatient();

    return (
      patient !== null &&
      patient.readAccess === 'active' &&
      patient.consultationPermission === 'granted' &&
      patient.status === 'in-consultation' &&
      Boolean(patient.consultationId)
    );
  });

  readonly records = computed(() => this.store.recordsForPatient(this.selectedPatientId()));

  readonly sortedRecords = computed(() =>
    [...this.records()].sort((a, b) => b.administeredOn.localeCompare(a.administeredOn)),
  );

  readonly formMode = signal<FormMode>('baseline');
  readonly correctingRecordId = signal<string | null>(null);
  readonly correctionReason = signal('');

  readonly vaccineName = signal('');
  readonly administeredOn = signal(new Date().toISOString().slice(0, 10));
  readonly doseDetails = signal('');
  readonly nextDoseOn = signal('');
  readonly notes = signal('');

  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');

  updatePatient(value: string): void {
    this.selectedPatientId.set(value);
    this.cancelCorrection();
    this.error.set('');
    this.message.set('');
  }

  startCorrection(record: VaccinationRecord): void {
    this.formMode.set('correction');
    this.correctingRecordId.set(record.id);

    this.vaccineName.set(record.vaccineName);
    this.administeredOn.set(record.administeredOn);
    this.doseDetails.set(record.doseDetails ?? '');
    this.nextDoseOn.set(record.nextDoseOn ?? '');
    this.notes.set(record.notes ?? '');

    this.correctionReason.set('');
    this.error.set('');
    this.message.set('');
  }

  cancelCorrection(): void {
    this.formMode.set('baseline');
    this.correctingRecordId.set(null);
    this.correctionReason.set('');
    this.resetForm();
  }

  private resetForm(): void {
    this.vaccineName.set('');
    this.administeredOn.set(new Date().toISOString().slice(0, 10));
    this.doseDetails.set('');
    this.nextDoseOn.set('');
    this.notes.set('');
  }

  async save(): Promise<void> {
    await this.saveRecord('baseline');
  }

  async saveCorrection(): Promise<void> {
    await this.saveRecord('correction');
  }

  private async saveRecord(mode: FormMode): Promise<void> {
    if (this.saving()) {
      return;
    }

    const patient = this.selectedPatient();

    if (!patient || !this.canRecord()) {
      this.error.set(
        'An active consultation, valid patient access and consultation permission are required.',
      );
      return;
    }

    const draft: VaccinationDraft = {
      vaccineName: this.vaccineName(),
      administeredOn: this.administeredOn(),
      doseDetails: this.doseDetails().trim() || null,
      nextDoseOn: this.nextDoseOn() || null,
      source: 'doctor',
      notes: this.notes().trim() || null,
    };

    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    try {
      if (mode === 'correction') {
        const recordId = this.correctingRecordId();

        if (!recordId) {
          throw new Error('Select a vaccination record to correct.');
        }

        await this.store.correct(
          recordId,
          draft,
          this.correctionReason(),
          patient.consultationId,
          patient.id,
        );

        this.message.set('Correction saved. The original record is preserved in version history.');

        this.cancelCorrection();
      } else {
        await this.store.add(draft, patient.consultationId, patient.id);

        this.message.set('Vaccination record saved successfully.');
        this.resetForm();
      }
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Unable to save the vaccination record.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00Z`));
  }

  sourceLabel(source: string): string {
    return source.replaceAll('_', ' ');
  }
}
