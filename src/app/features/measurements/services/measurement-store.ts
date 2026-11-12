import { Injectable, computed, signal } from '@angular/core';
import { MeasurementDraft, MeasurementRecord, validateDraft } from '../models/measurement.model';

/** ML-97 demo-only store. ML-102 must replace this with authenticated API calls. */
@Injectable()
export class MeasurementStore {
  private readonly recordsState = signal<MeasurementRecord[]>([
    {
      id: 'demo-bp',
      rootId: 'demo-bp',
      correctsId: null,
      recordedAt: '2026-10-28T08:15:00+05:30',
      createdAt: '2026-10-28T08:20:00+05:30',
      source: 'patient',
      reading: { kind: 'blood_pressure', systolic: 120, diastolic: 78, unit: 'mmHg' },
      correctionReason: null,
    },
    {
      id: 'demo-weight',
      rootId: 'demo-weight',
      correctsId: null,
      recordedAt: '2026-10-20T09:30:00+05:30',
      createdAt: '2026-10-20T09:32:00+05:30',
      source: 'patient',
      reading: { kind: 'weight', value: 64, unit: 'kg' },
      correctionReason: null,
    },
  ]);
  readonly history = this.recordsState.asReadonly();
  readonly current = computed(() => {
    const revisions = new Map<string, MeasurementRecord>();
    for (const record of this.recordsState()) revisions.set(record.rootId, record);
    return [...revisions.values()].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  });

  add(draft: MeasurementDraft): MeasurementRecord {
    this.ensureValid(draft);
    const id = crypto.randomUUID();
    const record: MeasurementRecord = {
      ...draft,
      id,
      rootId: id,
      correctsId: null,
      createdAt: new Date().toISOString(),
      correctionReason: null,
    };
    this.recordsState.update((records) => [...records, record]);
    return record;
  }

  correct(currentId: string, draft: MeasurementDraft, reason: string): MeasurementRecord {
    this.ensureValid(draft);
    const cleanedReason = reason.trim();
    if (!cleanedReason || cleanedReason.length > 500) {
      throw new Error('Enter a correction reason of 1–500 characters.');
    }
    const current = this.current().find((record) => record.id === currentId);
    if (!current) throw new Error('Only the latest version of a measurement can be corrected.');
    if (draft.reading.kind !== current.reading.kind) {
      throw new Error('A correction cannot change the measurement type.');
    }
    const record: MeasurementRecord = {
      ...draft,
      id: crypto.randomUUID(),
      rootId: current.rootId,
      correctsId: current.id,
      createdAt: new Date().toISOString(),
      correctionReason: cleanedReason,
    };
    // Append a new version. Never mutate or remove a previous record.
    this.recordsState.update((records) => [...records, record]);
    return record;
  }

  revisionsFor(rootId: string): MeasurementRecord[] {
    return this.recordsState()
      .filter((record) => record.rootId === rootId)
      .reverse();
  }

  private ensureValid(draft: MeasurementDraft): void {
    const error = validateDraft(draft);
    if (error) throw new Error(error);
  }
}
