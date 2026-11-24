import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReportCorrectionStore } from '../../services/report-correction.store';

@Component({
  selector: 'app-report-list-page',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './report-list-page.html',
})
export class ReportListPage {
  readonly s = inject(ReportCorrectionStore);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isPatient = this.route.snapshot.data['audience'] === 'patient';

  readonly requestRoute = '/workspace/lab-staff/upload-requests';

  select(id: string): void {
    void this.router.navigate([this.s.base, id]);
  }
}
