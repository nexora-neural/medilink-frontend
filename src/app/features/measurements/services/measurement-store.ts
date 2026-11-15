import { Injectable, computed, inject, signal } from '@angular/core';

import { MeasurementDraft, MeasurementRecord, validateDraft } from '../models/measurement.model';

import { MeasurementApiService } from './measurement-api.service';

@Injectable()
export class MeasurementStore {
  private readonly api = inject(MeasurementApiService);

  private patientId: string | null = null;

  private pendingCorrectionKey: string | null = null;

  private readonly activeState = signal<MeasurementRecord[]>([]);
  private readonly historyState = signal<MeasurementRecord[]>([]);

  readonly current = this.activeState.asReadonly();
  readonly history = this.historyState.asReadonly();

  readonly patientAdded = computed(
    () => this.activeState().filter((row) => row.source === 'patient').length,
  );

  async load(): Promise<void> {
    const patientId = await this.api.getPatientId();

    const records = await this.api.load(patientId);

    this.patientId = patientId;

    this.activeState.set(records.current);
    this.historyState.set(records.history);
  }

  async add(draft: MeasurementDraft): Promise<void> {
    const error = validateDraft(draft);

    if (error) {
      throw new Error(error);
    }

    if (!this.patientId) {
      throw new Error('Patient record is not loaded.');
    }

    await this.api.add(this.patientId, draft);

    await this.load();
  }

  async correct(currentId: string, draft: MeasurementDraft, reason: string): Promise<void> {
    const error = validateDraft(draft);

    if (error) {
      throw new Error(error);
    }

    const trimmedReason = reason.trim();

    if (!trimmedReason || trimmedReason.length > 500) {
      throw new Error('Enter a correction reason of 1–500 characters.');
    }

    const original = this.current().find((record) => record.id === currentId);

    if (
      !original ||
      original.source !== 'patient' ||
      (original.status !== undefined && original.status !== 'active')
    ) {
      throw new Error('Only active patient-added measurements can be corrected.');
    }

    if (draft.reading.kind !== original.reading.kind) {
      throw new Error('A correction cannot change the measurement type.');
    }

    const idempotencyKey = this.pendingCorrectionKey ?? crypto.randomUUID();

    this.pendingCorrectionKey = idempotencyKey;

    await this.api.correct(currentId, draft, trimmedReason, idempotencyKey);

    this.pendingCorrectionKey = null;

    await this.load();

  }

  revisionsFor(rootId: string): MeasurementRecord[] {
    return this.historyState().filter((record) => record.rootId === rootId);
  }
}
