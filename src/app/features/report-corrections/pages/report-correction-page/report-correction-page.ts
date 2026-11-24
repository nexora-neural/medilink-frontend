import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReportCorrectionStore } from '../../services/report-correction.store';

import { CorrectionFields } from '../../components/correction-fields/correction-fields';
import { CorrectionConfirmation } from '../../components/correction-confirmation/correction-confirmation';
import { ReportEmptyState } from '../../components/empty-state/empty-state';

@Component({
  selector: 'app-report-correction-page',
  standalone: true,
  imports: [RouterLink, CorrectionFields, CorrectionConfirmation, ReportEmptyState],
  templateUrl: './report-correction-page.html',
})
export class ReportCorrectionPage {
  readonly s = inject(ReportCorrectionStore);

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((params) => {
        this.s.select(params.get('id') ?? '');
        this.s.resetDraft();
      });
  }
  canLeave(): boolean {
    return this.s.canLeave();
  }
}
