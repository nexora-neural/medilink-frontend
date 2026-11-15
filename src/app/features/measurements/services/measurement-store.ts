import { Injectable, computed, inject, signal } from '@angular/core';

import { MeasurementDraft, MeasurementRecord, validateDraft } from '../models/measurement.model';

import { MeasurementApiService } from './measurement-api.service';

interface SaveResult {
  refreshed: boolean;
}

@Injectable()
export class MeasurementStore {
  private readonly api = inject(MeasurementApiService);

  private patientId: string | null = null;

  private pendingCorrection: {
    fingerprint: string;
    key: string;
  } | null = null;

  private readonly activeState = signal<MeasurementRecord[]>([]);
  private readonly historyState = signal<MeasurementRecord[]>([]);

  readonly current = this.activeState.asReadonly();
  readonly history = this.historyState.asReadonly();

  readonly historyUnavailable = signal(false);

  readonly patientAdded = computed(
    () => this.activeState().filter((row) => row.source === 'patient').length,
  );

  async load(): Promise<void> {
    const patientId = await this.api.getPatientId();

    const records = await this.api.load(patientId);

    this.patientId = patientId;

    this.activeState.set(records.current);
    this.historyState.set(records.history);
    this.historyUnavailable.set(records.historyUnavailable);
  }

  async add(draft: MeasurementDraft): Promise<SaveResult> {
    const error = validateDraft(draft);

    if (error) {
      throw new Error(error);
    }

    if (!this.patientId) {
      throw new Error('Patient record is not loaded.');
    }

    await this.api.add(this.patientId, draft);

    return this.refreshAfterSave();
  }

  async correct(currentId: string, draft: MeasurementDraft, reason: string): Promise<SaveResult> {
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

    // Preserve the original measurement unit.
    if (draft.reading.unit !== original.reading.unit) {
      throw new Error('A correction must preserve the original measurement unit.');
    }

    // Identify the exact correction operation.
    const fingerprint = JSON.stringify({
      currentId,
      draft,
      reason: trimmedReason,
    });

    // Reuse the same key only when retrying the same operation.
    const idempotencyKey =
      this.pendingCorrection?.fingerprint === fingerprint
        ? this.pendingCorrection.key
        : crypto.randomUUID();

    this.pendingCorrection = {
      fingerprint,
      key: idempotencyKey,
    };

    // Submit the correction to the backend.
    await this.api.correct(currentId, draft, trimmedReason, idempotencyKey);

    // Clear the key only after the API confirms success.
    this.pendingCorrection = null;

    return this.refreshAfterSave();
  }

  private async refreshAfterSave(): Promise<SaveResult> {
    try {
      await this.load();

      return { refreshed: true };
    } catch {
      // Saving succeeded, but refreshing failed.
      // Do not repeat the successful POST request.
      return { refreshed: false };
    }
  }

  revisionsFor(rootId: string): MeasurementRecord[] {
    return this.historyState().filter((record) => record.rootId === rootId);
  }
}
