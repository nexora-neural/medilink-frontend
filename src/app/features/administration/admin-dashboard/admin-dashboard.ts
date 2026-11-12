import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type PreviewState = 'ready' | 'loading' | 'empty' | 'error';

interface ReviewSummary {
  role: string;
  pendingCount: number;
}

const SAMPLE_REVIEWS: ReviewSummary[] = [
  { role: 'Doctor', pendingCount: 3 },
  { role: 'Pharmacist', pendingCount: 2 },
  { role: 'Lab Staff', pendingCount: 1 },
];

@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
})
export class AdminDashboard {
  readonly previewState = signal<PreviewState>('ready');

  readonly reviewSummaries = computed(() =>
    this.previewState() === 'ready' ? SAMPLE_REVIEWS : [],
  );

  readonly pendingCount = computed(() =>
    this.reviewSummaries().reduce((total, item) => total + item.pendingCount, 0),
  );

  setPreviewState(state: PreviewState): void {
    this.previewState.set(state);
  }

  retry(): void {
    this.previewState.set('ready');
  }
}
