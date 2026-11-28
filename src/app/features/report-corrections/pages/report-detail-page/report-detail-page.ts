import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReportCorrectionStore } from '../../services/report-correction.store';

import { ReportDetailsCard } from '../../components/details-card/details-card';
import { ReportEmptyState } from '../../components/empty-state/empty-state';

@Component({
  selector: 'app-report-detail-page',
  standalone: true,
  imports: [RouterLink, ReportDetailsCard, ReportEmptyState],
  templateUrl: './report-detail-page.html',
})
export class ReportDetailPage {
  readonly s = inject(ReportCorrectionStore);

  private readonly router = inject(Router);
  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => this.s.select(params.get('id') ?? ''));
  }
  correct(): void {
    void this.router.navigate([this.s.base, this.s.selectedId, 'correct']);
  }
}
