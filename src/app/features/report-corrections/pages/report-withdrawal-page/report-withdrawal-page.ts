import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReportCorrectionStore } from '../../services/report-correction.store';

import { WithdrawalReason } from '../../components/withdrawal-reason/withdrawal-reason';
import { WithdrawalConfirmation } from '../../components/withdrawal-confirmation/withdrawal-confirmation';
import { ReportEmptyState } from '../../components/empty-state/empty-state';

@Component({
  selector: 'app-report-withdrawal-page',
  standalone: true,
  imports: [RouterLink, WithdrawalReason, WithdrawalConfirmation, ReportEmptyState],
  templateUrl: './report-withdrawal-page.html',
})
export class ReportWithdrawalPage {
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
