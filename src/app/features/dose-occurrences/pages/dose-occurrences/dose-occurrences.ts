import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { UiState } from '../../../../shared/components/ui-state/ui-state';
import { DoseOccurrenceFilter } from '../../models/dose-occurrence.model';
import { DoseOccurrencesStore } from '../../services/dose-occurrences.store';

@Component({
  selector: 'app-dose-occurrences',
  standalone: true,
  imports: [CommonModule, DatePipe, UiState],
  templateUrl: './dose-occurrences.html',
  styleUrl: './dose-occurrences.scss',
})
export class DoseOccurrences {
  readonly store = inject(DoseOccurrencesStore);

  readonly activeFilter = signal<DoseOccurrenceFilter>('all');
  readonly selectedDurations = [10, 15, 30, 60] as const;
  readonly feedback = signal('');
  readonly feedbackError = signal(false);
  readonly selectedOccurrenceId = signal<string | null>(null);

  readonly filteredOccurrences = computed(() =>
    this.store.getFilteredOccurrences(this.activeFilter()),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.feedback.set('');
    this.store.loadDemoData();
  }

  setFilter(filter: DoseOccurrenceFilter): void {
    this.activeFilter.set(filter);
    this.feedback.set('');
  }

  selectOccurrence(occurrenceId: string): void {
    this.selectedOccurrenceId.update((current) => (current === occurrenceId ? null : occurrenceId));
    this.feedback.set('');
  }

  snooze(occurrenceId: string, minutes: number): void {
    this.feedback.set('');

    const result = this.store.snoozeOccurrence(occurrenceId, minutes);

    this.feedbackError.set(!result.success);
    this.feedback.set(result.message);

    if (result.success) {
      this.selectedOccurrenceId.set(null);
    }
  }

  isSnoozeEligible(status: string): boolean {
    return status === 'due' || status === 'unreported';
  }

  trackById(_: number, occurrence: { id: string }): string {
    return occurrence.id;
  }
}
