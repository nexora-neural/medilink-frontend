import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { UiState } from '../../../../shared/components/ui-state/ui-state';

import { CorrectionHistory } from '../../components/correction-history/correction-history';
import { MeasurementForm } from '../../components/measurement-form/measurement-form';
import { MeasurementList } from '../../components/measurement-list/measurement-list';

import { MeasurementDraft, MeasurementRecord } from '../../models/measurement.model';
import { MeasurementStore } from '../../services/measurement-store';

type PageState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-patient-measurements',
  standalone: true,
  imports: [UiState, CorrectionHistory, MeasurementForm, MeasurementList],
  providers: [MeasurementStore],
  templateUrl: './patient-measurements.html',
  styleUrl: './patient-measurements.scss',
})
export class PatientMeasurements {
  private readonly store = inject(MeasurementStore);
  private readonly route = inject(ActivatedRoute);

  readonly measurements = this.store.current;

  readonly pageState = signal<PageState>('ready');

  readonly formMode = signal<'add' | 'correct' | null>(null);

  readonly correcting = signal<MeasurementRecord | null>(null);

  readonly showHistory = signal(false);

  readonly message = signal('');
  readonly error = signal('');

  readonly total = computed(() => {
    const state = this.pageState();

    if (state === 'empty') return 0;
    if (state !== 'ready') return null;

    return this.measurements().length;
  });

  readonly patientAdded = computed(() => {
    const state = this.pageState();

    if (state === 'empty') return 0;
    if (state !== 'ready') return null;

    return this.measurements().filter((item) => item.source === 'patient').length;
  });

  readonly allHistory = computed(() =>
    [...this.store.history()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const state = params.get('preview');

      this.pageState.set(
        state === 'loading' || state === 'empty' || state === 'error' ? state : 'ready',
      );
    });
  }

  add(): void {
    this.formMode.set('add');
    this.correcting.set(null);
    this.message.set('');
    this.error.set('');
  }

  correct(record: MeasurementRecord): void {
    this.correcting.set(record);
    this.formMode.set('correct');
    this.message.set('');
    this.error.set('');
  }

  closeForm(): void {
    this.formMode.set(null);
    this.correcting.set(null);
    this.error.set('');
  }

  save(payload: { draft: MeasurementDraft; reason: string }): void {
    try {
      const target = this.correcting();

      if (target) {
        this.store.correct(target.id, payload.draft, payload.reason);
      } else {
        this.store.add(payload.draft);
      }

      this.message.set(
        target
          ? 'Correction saved. The original record remains in history.'
          : 'Measurement added successfully.',
      );

      this.closeForm();
      this.pageState.set('ready');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to save this measurement.');
    }
  }

  toggleHistory(): void {
    this.showHistory.update((value) => !value);
  }

  clearHistory(): void {
    this.showHistory.set(false);
  }

  retry(): void {
    this.pageState.set('ready');
    this.error.set('');
  }
}
