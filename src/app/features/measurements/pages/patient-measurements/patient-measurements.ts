import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { UiState } from '../../../../shared/components/ui-state/ui-state';

import { CorrectionHistory } from '../../components/correction-history/correction-history';
import { MeasurementForm } from '../../components/measurement-form/measurement-form';
import { MeasurementList } from '../../components/measurement-list/measurement-list';

import { MeasurementDraft, MeasurementRecord } from '../../models/measurement.model';
import { MeasurementApiService } from '../../services/measurement-api.service';
import { MeasurementStore } from '../../services/measurement-store';

type PageState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-patient-measurements',
  standalone: true,
  imports: [UiState, CorrectionHistory, MeasurementForm, MeasurementList],
  providers: [MeasurementApiService, MeasurementStore],
  templateUrl: './patient-measurements.html',
  styleUrl: './patient-measurements.scss',
})
export class PatientMeasurements implements OnInit {
  private readonly store = inject(MeasurementStore);

  readonly measurements = this.store.current;

  readonly pageState = signal<PageState>('loading');

  readonly saving = signal(false);

  readonly formMode = signal<'add' | 'correct' | null>(null);

  readonly correcting = signal<MeasurementRecord | null>(null);

  readonly showHistory = signal(false);

  readonly message = signal('');
  readonly error = signal('');

  readonly total = computed(() => {
    const state = this.pageState();

    if (state === 'loading' || state === 'error') return null;

    return this.measurements().length;
  });

  readonly patientAdded = computed(() => {
    const state = this.pageState();

    if (state === 'loading' || state === 'error') return null;

    return this.store.patientAdded();
  });

  readonly allHistory = computed(() =>
    [...this.store.history()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  ngOnInit(): void {
    void this.retry();
  }

  async retry(): Promise<void> {
    this.pageState.set('loading');
    this.error.set('');
    this.message.set('');

    try {
      await this.store.load();

      this.pageState.set(this.measurements().length > 0 ? 'ready' : 'empty');

      if (this.store.historyUnavailable()) {
        this.message.set('Measurements loaded. Correction history is temporarily unavailable.');
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load measurements.');

      this.pageState.set('error');
    }
  }

  add(): void {
    if (this.saving()) return;

    this.formMode.set('add');
    this.correcting.set(null);
    this.message.set('');
    this.error.set('');
  }

  correct(record: MeasurementRecord): void {
    if (this.saving() || record.source !== 'patient') return;

    this.correcting.set(record);
    this.formMode.set('correct');
    this.message.set('');
    this.error.set('');
  }

  closeForm(): void {
    if (this.saving()) return;

    this.formMode.set(null);
    this.correcting.set(null);
    this.error.set('');
  }

  async save(payload: { draft: MeasurementDraft; reason: string }): Promise<void> {
    if (this.saving()) return;

    this.saving.set(true);
    this.error.set('');

    const target = this.correcting();

    try {
      const result = target
        ? await this.store.correct(target.id, payload.draft, payload.reason)
        : await this.store.add(payload.draft);

      // Save succeeded. Close the form so it cannot be
      // submitted again accidentally.
      this.saving.set(false);
      this.closeForm();

      if (result?.refreshed === false) {
        this.message.set(
          'Measurement saved successfully, but the latest records could not be refreshed. Refresh the page to view the updated data.',
        );
        return;
      }

      this.message.set(
        target
          ? 'Correction saved. The original record remains in history.'
          : 'Measurement added successfully.',
      );

      if (this.store.historyUnavailable()) {
        this.message.set(
          'Measurement saved successfully. Correction history is temporarily unavailable.',
        );
      }

      this.pageState.set(this.measurements().length > 0 ? 'ready' : 'empty');
    } catch (error) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'Unable to confirm the save. Refresh the page to check before trying again.',
      );

      this.saving.set(false);
    }
  }

  toggleHistory(): void {
    this.showHistory.update((value) => !value);
  }

  clearHistory(): void {
    this.showHistory.set(false);
  }
}
