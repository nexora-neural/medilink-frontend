import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { UiState } from '../../../../shared/components/ui-state/ui-state';

import { VaccinationRecord } from '../../models/vaccination.model';
import { VaccinationStore } from '../../services/vaccination-store';

type PageState = 'ready' | 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-patient-vaccination-history',
  standalone: true,
  imports: [UiState],
  templateUrl: './patient-vaccination-history.html',
  styleUrl: './patient-vaccination-history.scss',
})
export class PatientVaccinationHistory implements OnInit {
  private readonly store = inject(VaccinationStore);

  readonly vaccinations = this.store.current;
  readonly history = this.store.history;

  readonly pageState = signal<PageState>('loading');
  readonly error = signal('');
  readonly showHistory = signal(false);

  readonly total = computed(() => this.store.totalCount());

  readonly sortedVaccinations = computed(() =>
    [...this.vaccinations()].sort((a, b) => b.administeredOn.localeCompare(a.administeredOn)),
  );

  readonly sortedHistory = computed(() =>
    [...this.history()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  ngOnInit(): void {
    void this.retry();
  }

  async retry(): Promise<void> {
    this.pageState.set('loading');
    this.error.set('');

    try {
      await this.store.load();

      this.pageState.set(this.vaccinations().length > 0 ? 'ready' : 'empty');
    } catch (error) {
      this.error.set(
        error instanceof Error ? error.message : 'Unable to load vaccination history.',
      );

      this.pageState.set('error');
    }
  }

  toggleHistory(): void {
    this.showHistory.update((value) => !value);
  }

  trackById(_index: number, record: VaccinationRecord): string {
    return record.id;
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
